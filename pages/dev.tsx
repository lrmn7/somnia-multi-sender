import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { explorerBaseUrl } from '../lib/contract';

type LogEntry = {
  type: 'success' | 'error';
  message: string;
  timestamp: string;
  hash?: string;
};

const padZero = (num: number) => num.toString().padStart(2, '0');
const getCurrentFormattedTime = () => {
  const time = new Date();
  const day = padZero(time.getDate());
  const month = padZero(time.getMonth() + 1);
  const year = time.getFullYear();
  const hours = padZero(time.getHours());
  const minutes = padZero(time.getMinutes());
  const seconds = padZero(time.getSeconds());
  return `${day}-${month}-${year} - ${hours}:${minutes}:${seconds}`;
};

const getRandomDelay = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

export default function HomePage() {
  const [displayTime, setDisplayTime] = useState('00-00-0000 - 00:00:00');
  const [isAuto, setIsAuto] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [logHistory, setLogHistory] = useState<LogEntry[]>([]);
  const [txCount, setTxCount] = useState(0);
  const [isClient, setIsClient] = useState(false);
  const isAutoRef = useRef(isAuto);
  
  useEffect(() => {
    isAutoRef.current = isAuto;
  }, [isAuto]);
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setIsClient(true);
    const clockInterval = setInterval(() => {
      setDisplayTime(getCurrentFormattedTime());
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  useEffect(() => {
    const sendTransaction = async () => {
      if (isSending) return;
      setIsSending(true);

      const txTimestamp = getCurrentFormattedTime();

      try {
        const response = await fetch('/api/log-timestamp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ timestamp: txTimestamp }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Error dari API');
        }

        setLogHistory(prev => [...prev, {
          type: 'success',
          message: data.message,
          timestamp: txTimestamp,
          hash: data.hash
        }]);
        setTxCount(prevCount => prevCount + 1);

      } catch (err: any) {
        console.error("Gagal memanggil API:", err);
        setLogHistory(prev => [...prev, {
          type: 'error',
          message: err.message || 'Error tidak diketahui',
          timestamp: txTimestamp
        }]);
      } finally {
        setIsSending(false);
      }
    };

    const runAutoTxLoop = async () => {
      if (!isAutoRef.current) return;
      await sendTransaction();
      const delay = getRandomDelay(1000, 3000);
      timeoutRef.current = setTimeout(runAutoTxLoop, delay);
    };

    if (isAuto) {
      runAutoTxLoop();
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isAuto]);

  return (
    <>
      <Head>
        <title>Somnia Time Logger</title>
        <meta name="description" content="dApp untuk mencatat waktu di Somnia Network" />
      </Head>
      <main className="flex flex-col items-center justify-center min-h-screen p-4 sm:p-8">
        <div className="w-full max-w-4xl p-6 border-4 border-brand-orange shadow-pixel-orange bg-brand-dark">
          <h1 className="text-4xl sm:text-5xl text-center mb-4">Somnia Time Logger</h1>
          <div className="text-center my-8 bg-black/30 p-4 border-2 border-brand-gray/50">
            <p className="text-lg text-brand-gray">Current Network Time</p>
            <p className="text-4xl sm:text-6xl tracking-widest">
              {isClient ? displayTime : '00-00-0000 - 00:00:00'}
            </p>
          </div>
          <div className="flex items-center justify-center space-x-4 my-8">
            <span className="text-2xl">Auto Mode</span>
            <div className="relative inline-block w-14 align-middle select-none transition duration-200 ease-in">
              <input
                type="checkbox"
                name="toggle"
                id="toggle"
                checked={isAuto}
                onChange={() => setIsAuto(!isAuto)}
                className="toggle-checkbox absolute block w-7 h-7 rounded-full bg-white border-4 appearance-none cursor-pointer"
              />
              <label htmlFor="toggle" className="toggle-label block overflow-hidden h-7 rounded-full bg-gray-600 cursor-pointer"></label>
            </div>
            <span className={`text-2xl ${isAuto ? 'text-green-400' : 'text-red-500'}`}>
              {isAuto ? 'ON' : 'OFF'}
            </span>
          </div>
          {isSending && <p className="text-center text-yellow-400 animate-pulse">Mengirim transaksi...</p>}
          <div className="mt-10">
            <div className='text-center mb-4'>
              <p className='text-brand-gray text-xl'>Total Transactions Sent: 
                <span className='text-brand-orange text-2xl font-bold ml-2'>{txCount}</span>
              </p>
            </div>
            <h2 className="text-3xl text-center mb-4">Activity Logs</h2>
            <div className="flex space-x-4">
              <div className="w-1/2">
                <h3 className="text-xl text-center text-red-500 mb-2">Error Log</h3>
                <div className="h-48 overflow-y-auto p-2 border-2 border-red-500/50 bg-black/30 text-lg">
                  <ul>
                    {logHistory.filter(log => log.type === 'error').reverse().map((log, index) => (
                      <li key={index} className="flex flex-col mb-2">
                        <span className="text-brand-gray text-xs">{log.timestamp}</span>
                        <span className="text-red-500 truncate" title={log.message}>{log.message}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="w-1/2">
                <h3 className="text-xl text-center text-green-400 mb-2">Success Log</h3>
                <div className="h-48 overflow-y-auto p-2 border-2 border-green-400/50 bg-black/30 text-lg">
                  <ul>
                    {logHistory.filter(log => log.type === 'success').reverse().map((log, index) => (
                      <li key={index} className="flex flex-col mb-2">
                        <span className="text-brand-gray text-xs">{log.timestamp}</span>
                        <a href={`${explorerBaseUrl}/tx/${log.hash}`} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline truncate" title={log.message}>
                          {log.hash?.substring(0, 20)}...
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}