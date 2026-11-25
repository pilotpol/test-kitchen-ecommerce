"use client";

import { useState, useCallback, useRef } from 'react';
import { useAuth } from '@repo/auth-core';
import { sendMessageBFF, abortStream } from './streaming';
import type { 
  DeltaEvent, 
  StepEvent, 
  ThinkingEvent, 
  ArtifactEvent, 
  ApprovalRequestEvent, 
  ApprovalResultEvent, 
  SourcesEvent 
} from './streaming';
import type { TMessage } from './types';

// Extend StepEvent for UI
export interface UITaskStep extends Omit<StepEvent, 'status'> {
  id: string;
  status: 'thinking' | 'running' | 'done' | 'error' | 'pending_approval';
  isFinal?: boolean;
}

export interface UseAdvancedPromptChatOptions {
  api?: string;
  initialMessages?: TMessage[];
  onFinish?: (message: string) => void;
  onError?: (error: Error) => void;
}

export function useAdvancedPromptChat(options: UseAdvancedPromptChatOptions = {}) {
  const { token } = useAuth();
  
  const [messages, setMessages] = useState<TMessage[]>(options.initialMessages || []);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [activeSteps, setActiveSteps] = useState<UITaskStep[]>([]);
  const [thinkingStatus, setThinkingStatus] = useState('');
  const [pendingArtifact, setPendingArtifact] = useState<ArtifactEvent | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (text: string, payloadOverrides?: Record<string, any>) => {
    if (isStreaming) return;
    
    setIsStreaming(true);
    setStreamingText('');
    setActiveSteps([]);
    setThinkingStatus('');
    setPendingArtifact(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Create minimal optimistic user message
    const userMsgId = `user-${Date.now()}`;
    const userMsg: TMessage = {
      messageId: userMsgId,
      parentMessageId: messages[messages.length - 1]?.messageId || '0',
      conversationId: payloadOverrides?.conversationId || 'local',
      sender: 'User',
      text,
      isCreatedByUser: true,
      error: false,
    };
    
    setMessages(prev => [...prev, userMsg]);

    const activeStepsRef = { current: [] as UITaskStep[] };
    let finalStreamingText = '';

    try {
      controller.signal.addEventListener('abort', () => {
        setIsStreaming(false);
      });
      
      await sendMessageBFF(
        {
          message: text,
          model: payloadOverrides?.model || '',
          endpoint: payloadOverrides?.endpoint || 'promptserv',
          ...payloadOverrides,
        } as any,
        {
          onDelta: (event: DeltaEvent) => {
            finalStreamingText += event.content;
            setStreamingText(finalStreamingText);
          },
          onStep: (event: StepEvent) => {
            const step: UITaskStep = { ...event, id: `step-${Date.now()}` };
            if (activeStepsRef.current.length > 0) {
              const lastStep = activeStepsRef.current[activeStepsRef.current.length - 1];
              if (lastStep?.title === step.title && lastStep?.status !== 'done') {
                // Update existing step
                activeStepsRef.current[activeStepsRef.current.length - 1] = {
                  ...lastStep,
                  ...step,
                };
                setActiveSteps([...activeStepsRef.current]);
                return;
              }
            }
            activeStepsRef.current.push(step);
            setActiveSteps([...activeStepsRef.current]);
          },
          onThinking: (event: ThinkingEvent) => {
            setThinkingStatus(event.detail);
          },
          onArtifact: (event: ArtifactEvent) => {
            setPendingArtifact(event);
          },
          onComplete: () => {
            // Append final message
            const aiMsg: TMessage = {
              messageId: `ai-${Date.now()}`,
              parentMessageId: userMsgId,
              conversationId: payloadOverrides?.conversationId || 'local',
              sender: 'AI',
              text: finalStreamingText,
              isCreatedByUser: false,
              error: false,
            };
            setMessages(prev => [...prev, aiMsg]);
            setIsStreaming(false);
            if (options.onFinish) options.onFinish(finalStreamingText);
          },
          onError: (error: Error) => {
            console.error('Stream error:', error);
            setIsStreaming(false);
            if (options.onError) options.onError(error);
          }
        },
        {
          token: token || undefined,
          signal: controller.signal,
          api: options.api
        }
      );
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Stream aborted by user');
      } else {
        console.error('sendMessageBFF throws:', err);
        if (options.onError) options.onError(err);
      }
      setIsStreaming(false);
    }
  }, [isStreaming, messages, token, options]);

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }
  }, []);

  return {
    messages,
    sendMessage,
    isStreaming,
    streamingText,
    activeSteps,
    thinkingStatus,
    pendingArtifact,
    setMessages,
    stop
  };
}
