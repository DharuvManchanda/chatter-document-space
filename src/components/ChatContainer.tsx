import React, { useState, useRef, useEffect } from 'react';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import UploadedItemsPanel from './UploadedItemsPanel';
import { Message, UploadedFile, GitHubLink } from '../types/chat';

const ChatContainer = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: 'Hello! I\'m your AI assistant. How can I help you today?',
      sender: 'ai',
      timestamp: new Date(),
    }
  ]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [githubLinks, setGithubLinks] = useState<GitHubLink[]>([]);
  const [currentStreamingMessageId, setCurrentStreamingMessageId] = useState<string | null>(null);
  const [isRewriteMode, setIsRewriteMode] = useState(false);
  const [lastUserMessage, setLastUserMessage] = useState<string>('');
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const connectWebSocket = () => {
      console.log('Establishing WebSocket connection...');
      setConnectionStatus('connecting');
      
      setTimeout(() => {
        setConnectionStatus('connected');
        console.log('WebSocket connected successfully');
      }, 1000);
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const handleWebSocketMessage = (data: any) => {
    console.log('Received WebSocket message:', data);
    
    switch (data.type) {
      case 'STREAM_START':
        setIsStreaming(true);
        const messageId = Date.now().toString();
        setCurrentStreamingMessageId(messageId);
        const newMessage: Message = {
          id: messageId,
          content: '',
          sender: 'ai',
          timestamp: new Date(),
          isStreaming: true,
        };
        setMessages(prev => [...prev, newMessage]);
        break;

      case 'STREAM_CHUNK':
        if (currentStreamingMessageId) {
          setMessages(prev => 
            prev.map(msg => 
              msg.id === currentStreamingMessageId 
                ? { ...msg, content: msg.content + data.content.content }
                : msg
            )
          );
        }
        break;

      case 'STREAM_END':
        setIsStreaming(false);
        setCurrentStreamingMessageId(null);
        if (currentStreamingMessageId) {
          setMessages(prev => 
            prev.map(msg => 
              msg.id === currentStreamingMessageId 
                ? { ...msg, isStreaming: false }
                : msg
            )
          );
        }
        break;

      default:
        console.log('Unknown message type:', data.type);
    }
  };

  const handleStopAndRewrite = () => {
    // Stop the current streaming
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'STOP_STREAM'
      }));
      console.log('Sent stop stream request');
    }
    
    setIsStreaming(false);
    setCurrentStreamingMessageId(null);
    
    // Remove the streaming AI message
    if (currentStreamingMessageId) {
      setMessages(prev => prev.filter(msg => msg.id !== currentStreamingMessageId));
    }
    
    // Find the last user message to allow rewriting
    const reversedMessages = [...messages].reverse();
    const lastUserIndex = reversedMessages.findIndex(msg => msg.sender === 'user');
    
    if (lastUserIndex !== -1) {
      const actualIndex = messages.length - 1 - lastUserIndex;
      const lastUserMsg = messages[actualIndex];
      setLastUserMessage(lastUserMsg.content);
      setIsRewriteMode(true);
    }
  };

  const handleStopChat = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'STOP_STREAM'
      }));
      console.log('Sent stop stream request');
    }
    
    setIsStreaming(false);
    setCurrentStreamingMessageId(null);
    
    if (currentStreamingMessageId) {
      setMessages(prev => 
        prev.map(msg => 
          msg.id === currentStreamingMessageId 
            ? { ...msg, isStreaming: false }
            : msg
        )
      );
    }
  };

  const handleUpdatePrompt = (newContent: string) => {
    setMessages(prev => {
      const reversedMessages = [...prev].reverse();
      const lastUserIndex = reversedMessages.findIndex(msg => msg.sender === 'user');
      
      if (lastUserIndex !== -1) {
        const actualIndex = prev.length - 1 - lastUserIndex;
        const updatedMessages = [...prev];
        updatedMessages[actualIndex] = {
          ...updatedMessages[actualIndex],
          content: newContent,
          timestamp: new Date(),
        };
        
        return updatedMessages.slice(0, actualIndex + 1);
      }
      return prev;
    });

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const payload = {
        type: 'UPDATE_PROMPT',
        content: {
          type: 'text',
          content: newContent,
        }
      };
      wsRef.current.send(JSON.stringify(payload));
      console.log('Sent updated prompt via WebSocket:', payload);
    }
  };

  const handleRewritePrompt = (newContent: string) => {
    // Remove messages after the last user message
    setMessages(prev => {
      const reversedMessages = [...prev].reverse();
      const lastUserIndex = reversedMessages.findIndex(msg => msg.sender === 'user');
      
      if (lastUserIndex !== -1) {
        const actualIndex = prev.length - 1 - lastUserIndex;
        const updatedMessages = [...prev];
        updatedMessages[actualIndex] = {
          ...updatedMessages[actualIndex],
          content: newContent,
          timestamp: new Date(),
        };
        
        return updatedMessages.slice(0, actualIndex + 1);
      }
      return prev;
    });

    // Send the new prompt
    const payload = {
      type: 'USER_MESSAGE',
      content: {
        type: 'text',
        content: newContent,
      }
    };

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
      console.log('Sent rewritten prompt via WebSocket:', payload);
    }

    setIsRewriteMode(false);
    setLastUserMessage('');
  };

  const handleSendMessage = (content: string, attachments?: File[], githubUrl?: string) => {
    if (attachments && attachments.length > 0) {
      const newFiles: UploadedFile[] = attachments.map(file => ({
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        name: file.name,
        type: file.type,
        size: file.size,
      }));
      setUploadedFiles(prev => [...prev, ...newFiles]);
    }

    if (githubUrl) {
      const newGithubLink: GitHubLink = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        url: githubUrl,
      };
      setGithubLinks(prev => [...prev, newGithubLink]);
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);

    const payload = {
      type: 'USER_MESSAGE',
      content: {
        type: 'text',
        content,
      }
    };

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
      console.log('Sent message via WebSocket:', payload);
    } else {
      console.log('WebSocket not connected, message payload ready:', payload);
      
      setTimeout(() => {
        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          content: `I received your message: "${content}". ${attachments?.length ? `You uploaded ${attachments.length} file(s). ` : ''}${githubUrl ? `GitHub URL: ${githubUrl}` : ''}`,
          sender: 'ai',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, aiResponse]);
      }, 1000);
    }
  };

  const handleDeleteFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(file => file.id !== fileId));
    console.log('Deleted file:', fileId);
  };

  const handleDeleteGithubLink = (linkId: string) => {
    setGithubLinks(prev => prev.filter(link => link.id !== linkId));
    console.log('Deleted GitHub link:', linkId);
  };

  return (
    <div className="flex-1 flex flex-col bg-white min-h-0">
      <ChatHeader connectionStatus={connectionStatus} />
      
      {(uploadedFiles.length > 0 || githubLinks.length > 0) && (
        <UploadedItemsPanel
          uploadedFiles={uploadedFiles}
          githubLinks={githubLinks}
          onDeleteFile={handleDeleteFile}
          onDeleteGithubLink={handleDeleteGithubLink}
        />
      )}
      
      <MessageList messages={messages} isStreaming={isStreaming} />
      <ChatInput 
        onSendMessage={handleSendMessage}
        onStopChat={handleStopChat}
        onStopAndRewrite={handleStopAndRewrite}
        onUpdatePrompt={handleUpdatePrompt}
        onRewritePrompt={handleRewritePrompt}
        disabled={connectionStatus !== 'connected'}
        isStreaming={isStreaming}
        isRewriteMode={isRewriteMode}
        lastUserMessage={lastUserMessage}
      />
    </div>
  );
};

export default ChatContainer;
