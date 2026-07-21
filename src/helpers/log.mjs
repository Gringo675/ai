import fs from 'node:fs'

const logFile = './logger.txt'

/** @type {import('node:fs').WriteStream | undefined} */
let stream

const startStream = () => {
  stream = fs.createWriteStream(logFile, { flags: 'a' }) // AutoClose:true
}

/**
 * @param {any} record
 */
export const toLog = record => {
  if (!stream) startStream()
  const lDateTime = new Date().toLocaleString()
  console.log(record)
  stream?.write(`${lDateTime}  ${record}\r\n`)
}
