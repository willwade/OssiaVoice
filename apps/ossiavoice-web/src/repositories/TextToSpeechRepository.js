import { useSettingsStore } from '@/stores/SettingsStore.js'

window.voice = null;
if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = function() {
    const voices = speechSynthesis.getVoices();
    window.voice = voices[1] || voices[0] || null;
  };
}

export default async function speak(text) {
  const settingsStore = useSettingsStore()

  if (!settingsStore.ttsEnabled) return

  if (!('speechSynthesis' in window)) {
    alert('Your browser does not support speech synthesis. Please use a supported browser or speech ' +
      'synthesis/recognition will not work');
    return
  }

  const voices = speechSynthesis.getVoices()
  const selectedVoice = voices.find((voice) => voice.name === settingsStore.ttsVoice)
  if (selectedVoice) {
    window.voice = selectedVoice
  }

  // Create a new instance of SpeechSynthesisUtterance.
  const msg = new SpeechSynthesisUtterance();

  // Set the text.
  msg.text = text;

  // Set the attributes.
  msg.volume = settingsStore.ttsVolume; // 0-1
  msg.rate = settingsStore.ttsRate; // 0.1-10
  msg.pitch = settingsStore.ttsPitch; // 0-2

  // If a voice has been selected, find the voice and set the
  // utterance instance's voice attribute.
  // msg.voice = await speechSynthesis.getVoices().filter((voice) => {
  //   console.log(voice.name)
  //   console.log(voice.name == 'Aaron')
  //   console.log(voice.name === 'Aaron')
  //   return voice.name === 'Aaron';
  // })[0];
  msg.voice = window.voice;
  // Queue this utterance.
  window.speechSynthesis.cancel();  // stop saying anything else
  window.speechSynthesis.speak(msg);
}
