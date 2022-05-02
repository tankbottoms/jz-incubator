/* eslint-disable one-var */
const BLANK: string = '';

export const sixteen_char_date = (date: Date) => {
  let monthPad: boolean = false,
    dayPad: boolean = false,
    hourPad: boolean = false,
    minutePad: boolean = false,
    secondPad: boolean = false,
    millisecPad: boolean = false;
  if ((date.getMonth() + 1).toString().length === 1) monthPad = true;
  if ((date.getDate() + 1).toString().length === 1) dayPad = true;
  if ((date.getHours() + 1).toString().length === 1) hourPad = true;
  if ((date.getMinutes() + 1).toString().length === 1) minutePad = true;
  if ((date.getSeconds() + 1).toString().length === 1) secondPad = true;
  if ((date.getMilliseconds() + 1).toString().length === 1) millisecPad = true;

  return (
    `${date.getFullYear()}` +
    `${monthPad ? 0 : BLANK}` +
    `${date.getMonth() + 1}` +
    `${dayPad ? 0 : BLANK}` +
    `${date.getDate()}` +
    `${hourPad ? 0 : BLANK}` +
    `${date.getHours()}` +
    `${minutePad ? 0 : BLANK}` +
    `${date.getMinutes()}` +
    `${secondPad ? 0 : BLANK}` +
    `${date.getSeconds()}` +
    `${millisecPad ? 0 : BLANK}` +
    `${date.getMilliseconds().toString().slice(-2)}`
  ).toString(); // 202101012359010111
};
