// オリジナルの短い電子音をPCM WAVとして生成。第三者の音源は使用しない。
const fs = require("node:fs");
const path = require("node:path");
const directory = path.join(__dirname, "../assets/audio");
fs.mkdirSync(directory, { recursive: true });
function writeSound(name, notes) {
  const rate = 22050;
  const duration = 0.16;
  const frames = Math.floor(notes.length * duration * rate);
  const wav = Buffer.alloc(44 + frames * 2);
  wav.write("RIFF", 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write("data", 36); wav.writeUInt32LE(frames * 2, 40);
  for (let i = 0; i < frames; i++) {
    const time = i / rate;
    const note = Math.min(notes.length - 1, Math.floor(time / duration));
    const local = time - note * duration;
    const envelope = Math.min(1, local / 0.012) * Math.max(0, 1 - local / duration);
    wav.writeInt16LE(Math.round(Math.sin(2 * Math.PI * notes[note] * local) * envelope * 7000), 44 + i * 2);
  }
  fs.writeFileSync(path.join(directory, name + ".wav"), wav);
}
writeSound("mission", [659.25, 880]);
writeSound("complete", [523.25, 659.25, 783.99, 1046.5]);
