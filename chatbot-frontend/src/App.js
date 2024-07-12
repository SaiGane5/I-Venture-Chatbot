import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import axios from 'axios';
import Papa from 'papaparse';
import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { fromEnv } from '@aws-sdk/credential-provider-env';
import { debounce } from 'lodash';
import './App.css';
import env from "react-dotenv";

// Configure AWS SDK v3
const s3Client = new S3Client({
  region: 'us-east-1',
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  }
});

const App = () => {
  const [username, setUsername] = useState('');
  const [isUsernameSubmitted, setIsUsernameSubmitted] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false); // New state for login
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  // const [feedbacks, setFeedbacks] = useState([]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleUsernameSubmit = async (e) => {
    e.preventDefault();
    if (username.trim() === '') {
      setError('Username cannot be empty');
      return;
    }

    const usernameExists = await checkUsernameExists(username);
    if (usernameExists) {
      setError('Username already exists');
      return;
    }

    setIsUsernameSubmitted(true);
    setError('');
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (username.trim() === '') {
      setError('Username cannot be empty');
      return;
    }

    const usernameExists = await checkUsernameExists(username);
    if (!usernameExists) {
      setError('Username does not exist');
      return;
    }

    setIsUsernameSubmitted(true);
    setError('');
  };

  const handleEndSession = async () => {
    await saveToCSV();
    // Additional logic to end the session, if needed
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (message.trim() === '') return;

    const newMessage = { role: 'user', content: message };
    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);

    setLoading(true);
    try {
      const response = await axios.post('http://52.0.160.0:8080/api/chat', {
        prompt: message,
        message_history: updatedMessages,
      });
      const botMessage = {
        role: 'assistant',
        content: `RAG ANSWER:  \n\n${response.data.rag_response.replace(/\n/g, '  \n')}  \n\nWEB ANSWER:  \n\n${response.data.web_response.replace(/\n/g, '  \n  ')}  \n\n\n\nFollow up questions are :  \n\n${response.data.suggested_questions.replace(/\n/g, '  \n  ')}`,
        rating: 0,
      };
      if (response.data) {
        const finalMessages = [...updatedMessages, botMessage];
        setMessages(finalMessages);
        // await saveToCSV(newMessage, botMessage);
      }
    } catch (error) {
      console.error('Error fetching response:', error);
    }
    setLoading(false);
    setMessage('');
  };

  const handleFeedbackChange = (index, feedback) => {
    const updatedMessages = [...messages];
    updatedMessages[index].feedback = feedback;
    setMessages(updatedMessages);
  };

  const handleRatingChange = async (index, rating) => {
    const updatedMessages = [...messages];
    updatedMessages[index].rating = rating;
    setMessages(updatedMessages);

    // Save to CSV after rating change
    // await saveToCSV();
  };

  const saveToCSV = async () => {
    try {
      // Fetch existing data from S3
      const existingData = await downloadFromS3();
      const data = existingData ? Papa.parse(existingData, { header: true }).data : [];

      // Append new data
      for (let i = 0; i < messages.length; i++) {
        if (messages[i].role === 'user' && messages[i + 1] && messages[i + 1].role === 'assistant') {
          data.push({
            Question: messages[i].content,
            Response: messages[i + 1].content,
            Rating: messages[i + 1].rating,
            Feedback: messages[i + 1].feedback, // Include feedback
          });
          i++; // Skip the next message as it's already paired
        }
      }

      const csv = Papa.unparse(data);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const file = new File([blob], 'chat_data.csv');

      await uploadToS3(file);
    } catch (error) {
      console.error('Error saving to CSV:', error);
    }
  };

  const downloadFromS3 = async () => {
    try {
      const command = new GetObjectCommand({
        Bucket: 'aiex',
        Key: `react_app_ibot/${username}/chat_data.csv`,
      });
      const { Body } = await s3Client.send(command);

      if (Body instanceof ReadableStream) {
        return await streamToString(Body);
      } else if (Body instanceof Blob) {
        return await blobToString(Body);
      } else if (Body instanceof ArrayBuffer) {
        return new TextDecoder('utf-8').decode(Body);
      } else {
        throw new Error('Unsupported Body type');
      }
    } catch (err) {
      if (err.name === 'NoSuchKey') {
        return null;
      }
      throw err;
    }
  };

  const streamToString = (stream) => {
    return new Promise((resolve, reject) => {
      const reader = stream.getReader();
      const chunks = [];
      const pump = () => reader.read().then(({ done, value }) => {
        if (done) {
          resolve(new TextDecoder('utf-8').decode(new Uint8Array(chunks.flat())));
          return;
        }
        chunks.push(value);
        pump();
      }).catch(reject);
      pump();
    });
  };

  const blobToString = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(blob);
    });
  };

  const uploadToS3 = async (file) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-'); // Generate a timestamp
    const params = {
      Bucket: 'aiex',
      Key: `react_app_ibot/${username}/chat_data_${timestamp}.csv`, // Append the timestamp to the file name
      Body: file,
      ContentType: 'text/csv',
    };

    const command = new PutObjectCommand(params);
    try {
      await s3Client.send(command);
      console.log('Successfully uploaded to S3');
    } catch (err) {
      console.error('Error uploading to S3:', err);
    }
  };

  const checkUsernameExists = async (username) => {
    try {
      const command = new ListObjectsV2Command({
        Bucket: 'aiex',
        Prefix: `react_app_ibot/${username}/`,
      });
      const { Contents } = await s3Client.send(command);
      return Contents && Contents.length > 0;
    } catch (err) {
      console.error('Error checking username:', err);
      return false;
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (username.trim() === '') {
      setError('Username cannot be empty');
      return;
    }

    const usernameExists = await checkUsernameExists(username);
    if (usernameExists) {
      setError('Username already exists. Please choose another.');
      return;
    }

    // Create a new folder for the username in S3
    await createUsernameFolder(username);
    setIsUsernameSubmitted(true);
    setError('');
  };

  const createUsernameFolder = async (username) => {
    const params = {
      Bucket: 'aiex',
      Key: `react_app_ibot/${username}/`,
      Body: '',
    };

    const command = new PutObjectCommand(params);
    try {
      await s3Client.send(command);
      console.log('Successfully created username folder in S3');
    } catch (err) {
      console.error('Error creating username folder in S3:', err);
    }
  };

  return (
    <div className="app">
      {!isUsernameSubmitted ? (
        <div className="login-container">
          <div className='landing-page'>
            <h1>I-Venture @ ISB: Gen AI Bot</h1>
            <h2>Instructions:</h2>
            <ul>
              <li>Registration:</li>
              <ol>
                <li>Enter your username</li>
                <li>Click register, if you have not created a username earlier</li>
              </ol>
              <li>Logging In:</li>
              <ol>
                <li>Click login, if you have created a username before</li>
                <li>Enter username and click login</li>
              </ol>
              <li>After logging in, you are ready to ask questions about I-Venture</li>
              <li>
                You can get two different responses
                <ol>
                  <li>RAG ANSWER: These answers are generated using the true data gathered from I-Venture @ ISB</li>
                  <li>WEB ANSWER: These answers are generated using web search</li>
                </ol>
              </li>
              <li>Rate the answers and give feedback by pressing SHARE DATA button, this will help us a lot to improve our model</li>
            </ul>
            <footer>Powered by <a href="https://ai-guru-kul.vercel.app" target="blank">AIGurukul</a></footer>
          </div>
          {!isLoggingIn ? (
            <form onSubmit={handleUsernameSubmit} className="username-form">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="username-input"
              />
              <button type="submit" className="submit-button">Register</button>
              <button type="button" className="submit-button" onClick={() => setIsLoggingIn(true)}>Login</button>
              {error && <div className="error">{error}</div>}
            </form>
          ) : (
            <form onSubmit={handleLoginSubmit} className="login-form">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="username-input"
              />
              <button type="submit" className="submit-button">Login</button>
              <button type="button" className="submit-button" onClick={() => setIsLoggingIn(false)}>Register</button>
              {error && <div className="error">{error}</div>}
            </form>
          )}
        </div>
      ) : (
        <div className="chat-container">
          <header>The Gen AI bot: Know about I-Venture@ISB</header>
          <div className="messages">
            {messages.map((msg, index) => (
              <div key={index} className={`message ${msg.role}`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                {msg.role === 'assistant' && (
                  <div className="rating-container">
                    <label>Rate this response:</label>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={msg.rating}
                      onChange={(e) => handleRatingChange(index, e.target.value)}
                      className="rating-slider"
                      style={{ '--slider-value': `${(msg.rating - 1) * 25}%` }} // Assuming rating is between 1 and 5
                    />
                    <span>{msg.rating}</span>
                    <input
                      type="text"
                      value={msg.feedback}
                      onChange={(e) => handleFeedbackChange(index, e.target.value)}
                      placeholder="Enter your feedback"
                      className="feedback-input"
                    />
                  </div>
                )}
              </div>
            ))}
            {loading && <div className="message thinking">Thinking...</div>}
            <div ref={messagesEndRef} />
          </div>
          <form onSubmit={handleSubmit} className="message-form">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message here..."
              className="message-input"
              disabled={loading}
            />
            <button type="submit" className="send-button" disabled={loading}>Send</button>
          </form>
          <button onClick={handleEndSession} className="end-session-button">SHARE DATA</button>
          <footer>Powered by <a href="https://ai-guru-kul.vercel.app" target="blank"> AIGuruKul</a></footer>
        </div>
      )}
    </div>
  );
};

export default App;