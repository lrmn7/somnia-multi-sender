import { useState, useEffect } from 'react';

const padZero = (num: number) => num.toString().padStart(2, '0');

export const useClock = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timerId = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timerId);
  }, []);

  const day = padZero(time.getDate());
  const month = padZero(time.getMonth() + 1);
  const year = time.getFullYear();
  const hours = padZero(time.getHours());
  const minutes = padZero(time.getMinutes());
  const seconds = padZero(time.getSeconds());

  return `${day}-${month}-${year} - ${hours}:${minutes}:${seconds}`;
};