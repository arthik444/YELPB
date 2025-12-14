import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mic, Loader2 } from 'lucide-react';
import { apiService } from '../services/api';

interface VoiceModeProps {
    isOpen: boolean;
    onClose: () => void;
    onTranscription: (text: string) => void;
    onAIResponse: (text: string) => void;
    onPreferencesDetected?: (prefs: any) => void;
}

type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking';

export function VoiceMode({ isOpen, onClose, onTranscription, onAIResponse, onPreferencesDetected }: VoiceModeProps) {
    const [voiceState, setVoiceState] = useState<VoiceState>('idle');
    const [transcription, setTranscription] = useState<string>('');
    const [aiResponse, setAiResponse] = useState<string>('');
    const [audioLevel, setAudioLevel] = useState(0);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastSpeechTimeRef = useRef<number>(Date.now());
    const animationFrameRef = useRef<number | null>(null);
    const isRecordingRef = useRef<boolean>(false);
    const lastValidTranscriptionRef = useRef<boolean>(false); // Track if last transcription was valid
    const isOpenRef = useRef<boolean>(isOpen); // Track open state for closures

    const SILENCE_THRESHOLD = 15; // Audio level below this is considered silence
    const SILENCE_DURATION = 2000; // Stop after 2 seconds of silence
    const MIN_RECORDING_TIME = 1000; // Minimum recording time before silence detection kicks in

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cleanup();
        };
    }, []);

    const cleanup = () => {
        console.log('🎤 Cleanup: Releasing microphone...');

        // Stop animation frame
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }

        // Clear silence timer
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }

        // Stop media recorder
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            try {
                mediaRecorderRef.current.stop();
            } catch (e) {
                // Already stopped
            }
        }
        mediaRecorderRef.current = null;

        // Close audio context
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close().catch(() => { });
        }
        audioContextRef.current = null;
        analyserRef.current = null;

        // CRITICAL: Stop all microphone tracks to release the mic
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => {
                track.stop();
                console.log('🎤 Track stopped:', track.kind, track.readyState);
            });
            streamRef.current = null;
        }

        // Clear recording flag
        isRecordingRef.current = false;
        console.log('🎤 Cleanup complete - microphone released');
    };

    // Keep a ref to current voiceState for use in useEffect without causing re-runs
    const voiceStateRef = useRef(voiceState);
    useEffect(() => {
        voiceStateRef.current = voiceState;
    }, [voiceState]);



    const startListening = async () => {
        // CRITICAL: Don't start listening if modal is already closed
        if (!isOpenRef.current) {
            console.log('🛑 startListening blocked - modal is closed');
            return;
        }

        try {
            console.log('🎤 Starting new microphone stream...');
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Double-check modal is still open AFTER getting the stream
            if (!isOpenRef.current) {
                console.log('🛑 Modal closed while getting stream - releasing immediately');
                stream.getTracks().forEach(track => track.stop());
                return;
            }

            streamRef.current = stream;

            // Set up audio analysis for silence detection
            audioContextRef.current = new AudioContext();
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 256;
            const source = audioContextRef.current.createMediaStreamSource(stream);
            source.connect(analyserRef.current);

            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];
            lastSpeechTimeRef.current = Date.now();

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                await processAudio(audioBlob);
            };

            mediaRecorder.start();
            setVoiceState('listening');
            isRecordingRef.current = true; // Set recording flag for closure

            // Start monitoring audio levels for silence detection
            monitorAudioLevel();
        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert('Could not access microphone. Please check permissions.');
            onClose();
        }
    };

    const monitorAudioLevel = () => {
        if (!analyserRef.current || !isRecordingRef.current) return;

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate average audio level
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(average);

        const now = Date.now();
        const recordingStartTime = lastSpeechTimeRef.current - SILENCE_DURATION;
        const recordingDuration = now - recordingStartTime;

        if (average > SILENCE_THRESHOLD) {
            // Speech detected - reset silence timer
            lastSpeechTimeRef.current = now;
            if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = null;
            }
        } else if (recordingDuration > MIN_RECORDING_TIME) {
            // Silence detected - check if we should stop
            const silenceDuration = now - lastSpeechTimeRef.current;
            if (silenceDuration > SILENCE_DURATION && !silenceTimerRef.current) {
                console.log('Silence detected for', silenceDuration, 'ms, stopping...');
                silenceTimerRef.current = setTimeout(() => {
                    if (isRecordingRef.current) {
                        console.log('Auto-stopping recording due to silence');
                        stopListening();
                    }
                }, 100);
            }
        }

        // Continue monitoring only if still recording
        if (isRecordingRef.current) {
            animationFrameRef.current = requestAnimationFrame(monitorAudioLevel);
        }
    };

    const stopListening = () => {
        if (mediaRecorderRef.current && isRecordingRef.current) {
            isRecordingRef.current = false; // Clear recording flag
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
            }
            mediaRecorderRef.current.stop();
            setVoiceState('processing');

            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close().catch(() => { });
            }
        }
    };


    const processAudio = async (audioBlob: Blob) => {
        try {
            // Convert audio to base64
            const reader = new FileReader();
            reader.onload = async () => {
                const base64Audio = (reader.result as string).split(',')[1];

                // Use unified AI-powered voice processing (Gemini)
                // This intelligently understands context, restaurant names, and infers preferences
                const result = await apiService.processVoiceUnified(
                    base64Audio,
                    'audio/webm',
                    '', // session context could be passed here if needed
                    {}  // current preferences could be passed here if needed
                );

                const text = result.transcription || '';
                setTranscription(text);


                // Track if this was a valid transcription (for restart logic)
                const isValidTranscription = Boolean(result.success && text &&
                    !text.toLowerCase().includes('no speech') &&
                    !text.toLowerCase().includes('no clear speech') &&
                    !text.toLowerCase().includes('no discernible') &&
                    !text.toLowerCase().includes('typing sound') &&
                    !text.toLowerCase().includes('background noise') &&
                    !text.toLowerCase().includes('ambient noise') &&
                    text.trim().length > 0);
                lastValidTranscriptionRef.current = isValidTranscription;
                console.log('Transcription valid:', isValidTranscription, 'Text:', text);

                // Only process if valid transcription
                if (isValidTranscription) {
                    onTranscription(text);

                    // AI has detected preferences (e.g., "Taco Bell" -> Mexican, $, fast food)
                    if (result.detected_preferences && Object.keys(result.detected_preferences).length > 0) {
                        console.log('AI detected preferences:', result.detected_preferences);
                        onPreferencesDetected?.(result.detected_preferences);
                    }

                    // Use AI-generated response (intelligent, context-aware)
                    const responseText = result.ai_response || "I'm here to help! What kind of restaurant are you looking for?";
                    setAiResponse(responseText);
                    onAIResponse(responseText);

                    // Convert to speech
                    setVoiceState('speaking');
                    await speakResponse(responseText);
                } else {
                    // Invalid transcription - just go back to idle, don't send to chat
                    console.log('Invalid transcription, not sending to chat');
                    setVoiceState('idle');
                }
            };
            reader.readAsDataURL(audioBlob);
        } catch (error) {
            console.error('Error processing audio:', error);
            setVoiceState('idle');
        }
    };



    const speakResponse = async (text: string) => {
        try {
            console.log('Generating TTS for:', text);

            // Use Gemini TTS API
            const result = await apiService.textToSpeech(text);

            if (result.success && result.audio_base64 && result.mime_type) {
                // Create audio from base64
                const audioData = atob(result.audio_base64);
                const audioBytes = new Uint8Array(audioData.length);
                for (let i = 0; i < audioData.length; i++) {
                    audioBytes[i] = audioData.charCodeAt(i);
                }

                // Check if it's raw PCM data that needs WAV headers
                let audioBlob: Blob;
                if (result.mime_type.includes('L16') || result.mime_type.includes('pcm')) {
                    // Convert raw PCM to WAV
                    console.log('Converting PCM to WAV...');
                    const sampleRate = 24000;  // Gemini TTS uses 24kHz
                    const numChannels = 1;
                    const bitsPerSample = 16;

                    // Create WAV header
                    const wavHeader = new ArrayBuffer(44);
                    const view = new DataView(wavHeader);

                    // "RIFF" chunk descriptor
                    view.setUint8(0, 'R'.charCodeAt(0));
                    view.setUint8(1, 'I'.charCodeAt(0));
                    view.setUint8(2, 'F'.charCodeAt(0));
                    view.setUint8(3, 'F'.charCodeAt(0));
                    view.setUint32(4, 36 + audioBytes.length, true);  // File size
                    view.setUint8(8, 'W'.charCodeAt(0));
                    view.setUint8(9, 'A'.charCodeAt(0));
                    view.setUint8(10, 'V'.charCodeAt(0));
                    view.setUint8(11, 'E'.charCodeAt(0));

                    // "fmt " sub-chunk
                    view.setUint8(12, 'f'.charCodeAt(0));
                    view.setUint8(13, 'm'.charCodeAt(0));
                    view.setUint8(14, 't'.charCodeAt(0));
                    view.setUint8(15, ' '.charCodeAt(0));
                    view.setUint32(16, 16, true);  // Subchunk1Size (16 for PCM)
                    view.setUint16(20, 1, true);   // AudioFormat (1 for PCM)
                    view.setUint16(22, numChannels, true);
                    view.setUint32(24, sampleRate, true);
                    view.setUint32(28, sampleRate * numChannels * bitsPerSample / 8, true);  // ByteRate
                    view.setUint16(32, numChannels * bitsPerSample / 8, true);  // BlockAlign
                    view.setUint16(34, bitsPerSample, true);

                    // "data" sub-chunk
                    view.setUint8(36, 'd'.charCodeAt(0));
                    view.setUint8(37, 'a'.charCodeAt(0));
                    view.setUint8(38, 't'.charCodeAt(0));
                    view.setUint8(39, 'a'.charCodeAt(0));
                    view.setUint32(40, audioBytes.length, true);

                    // Combine header and audio data
                    const wavBytes = new Uint8Array(wavHeader.byteLength + audioBytes.length);
                    wavBytes.set(new Uint8Array(wavHeader), 0);
                    wavBytes.set(audioBytes, 44);

                    audioBlob = new Blob([wavBytes], { type: 'audio/wav' });
                } else {
                    audioBlob = new Blob([audioBytes], { type: result.mime_type });
                }

                const audioUrl = URL.createObjectURL(audioBlob);

                // Create and play audio
                const audio = new Audio(audioUrl);
                audioRef.current = audio;

                audio.onended = () => {
                    console.log('TTS audio ended');
                    URL.revokeObjectURL(audioUrl);

                    // CRITICAL: Check if modal is still open BEFORE doing anything
                    if (!isOpenRef.current) {
                        console.log('🛑 Modal is closed - NOT restarting listening');
                        return;
                    }

                    setVoiceState('idle');
                    // Only restart if modal is STILL open and last transcription was valid
                    setTimeout(() => {
                        // Double-check again after the timeout
                        if (isOpenRef.current && lastValidTranscriptionRef.current) {
                            console.log('✅ Restarting listening...');
                            startListening();
                        } else {
                            console.log('🛑 Not restarting - modal closed or invalid transcription');
                        }
                    }, 1000);
                };

                audio.onerror = (e) => {
                    console.error('TTS audio playback error:', e);
                    URL.revokeObjectURL(audioUrl);
                    setVoiceState('idle');
                };

                await audio.play();
                console.log('Playing TTS audio');
            } else {
                // Fallback to browser speech synthesis
                console.warn('TTS API failed, falling back to browser speech:', result.error);
                if ('speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                    const utterance = new SpeechSynthesisUtterance(text);
                    utterance.rate = 1.0;
                    utterance.pitch = 1.0;
                    utterance.onend = () => {
                        if (!isOpenRef.current) {
                            console.log('🛑 Modal is closed - NOT restarting listening (speech synthesis)');
                            return;
                        }
                        setVoiceState('idle');
                        setTimeout(() => {
                            if (isOpenRef.current && lastValidTranscriptionRef.current) {
                                console.log('✅ Restarting listening (speech synthesis)...');
                                startListening();
                            }
                        }, 1000);
                    };
                    utterance.onerror = () => setVoiceState('idle');
                    window.speechSynthesis.speak(utterance);
                } else {
                    setVoiceState('idle');
                }
            }
        } catch (error) {
            console.error('TTS error:', error);
            setVoiceState('idle');
        }
    };

    const handleOrbClick = () => {
        if (voiceState === 'listening') {
            stopListening();
        } else if (voiceState === 'idle') {
            startListening();
        }
    };

    const handleClose = () => {
        console.log('🎤 handleClose called - stopping everything');

        // FIRST: Update ref to prevent any callbacks from restarting
        isOpenRef.current = false;

        // Stop media recorder regardless of state
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            try {
                mediaRecorderRef.current.stop();
            } catch (e) {
                console.log('Media recorder already stopped');
            }
        }

        // Stop any playing TTS audio and remove event handlers
        if (audioRef.current) {
            audioRef.current.onended = null; // Remove handler BEFORE pausing
            audioRef.current.onerror = null;
            audioRef.current.pause();
            audioRef.current = null;
        }

        // Cancel browser speech if running
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }

        // Full cleanup - stops mic stream
        cleanup();

        setVoiceState('idle');
        setTranscription('');
        setAiResponse('');
        onClose();
    };

    const getStatusText = () => {
        switch (voiceState) {
            case 'listening':
                return 'Listening...';
            case 'processing':
                return 'Processing...';
            case 'speaking':
                return 'Speaking...';
            default:
                return 'Tap to speak';
        }
    };

    // Auto-start listening when opened, cleanup when closed
    useEffect(() => {
        // Keep ref in sync with prop for closures
        isOpenRef.current = isOpen;

        if (isOpen && voiceStateRef.current === 'idle') {
            startListening();
        } else if (!isOpen) {
            // Modal is closing - ensure mic is released immediately
            console.log('🎤 Modal closing - releasing microphone');
            cleanup();
            setVoiceState('idle');
            setTranscription('');
            setAiResponse('');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-xl"
                >
                    {/* Close button - solid for visibility */}
                    <motion.button
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        onClick={handleClose}
                        className="absolute top-8 right-8 rounded-full p-3 shadow-lg"
                        style={{ backgroundColor: '#374151' }}
                        whileHover={{ scale: 1.1, backgroundColor: '#1f2937' }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <X className="h-6 w-6 text-white" />
                    </motion.button>

                    {/* Animated Orb */}
                    <div className="relative flex items-center justify-center" onClick={handleOrbClick}>
                        {/* Outer rings - wave animation */}
                        {voiceState === 'listening' && (
                            <>
                                {[1, 2, 3].map((ring) => (
                                    <motion.div
                                        key={ring}
                                        className="absolute rounded-full border-2 border-orange-500/30"
                                        initial={{ width: 120, height: 120, opacity: 0.8 }}
                                        animate={{
                                            width: [120, 200 + ring * 40],
                                            height: [120, 200 + ring * 40],
                                            opacity: [0.6, 0],
                                        }}
                                        transition={{
                                            duration: 2,
                                            delay: ring * 0.4,
                                            repeat: Infinity,
                                            ease: 'easeOut',
                                        }}
                                    />
                                ))}
                            </>
                        )}

                        {/* Processing pulse */}
                        {voiceState === 'processing' && (
                            <motion.div
                                className="absolute rounded-full bg-orange-500/20"
                                animate={{
                                    width: [160, 180, 160],
                                    height: [160, 180, 160],
                                    opacity: [0.5, 0.8, 0.5],
                                }}
                                transition={{
                                    duration: 1,
                                    repeat: Infinity,
                                    ease: 'easeInOut',
                                }}
                            />
                        )}

                        {/* Speaking animation */}
                        {voiceState === 'speaking' && (
                            <>
                                {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                                    <motion.div
                                        key={i}
                                        className="absolute w-1 bg-gradient-to-t from-orange-500 to-orange-300 rounded-full"
                                        style={{
                                            height: 40,
                                            transform: `rotate(${i * 45}deg) translateY(-60px)`,
                                            transformOrigin: 'center 80px',
                                        }}
                                        animate={{
                                            scaleY: [1, 1.5, 0.8, 1.2, 1],
                                            opacity: [0.8, 1, 0.6, 0.9, 0.8],
                                        }}
                                        transition={{
                                            duration: 0.5,
                                            delay: i * 0.1,
                                            repeat: Infinity,
                                            ease: 'easeInOut',
                                        }}
                                    />
                                ))}
                            </>
                        )}

                        {/* Core orb */}
                        <motion.div
                            className="relative z-10 flex items-center justify-center rounded-full cursor-pointer"
                            style={{
                                width: 140,
                                height: 140,
                                background: 'linear-gradient(135deg, #F97316 0%, #fb923c 50%, #F97316 100%)',
                                boxShadow: voiceState === 'listening'
                                    ? '0 0 60px rgba(249, 115, 22, 0.6)'
                                    : '0 0 40px rgba(249, 115, 22, 0.4)',
                            }}
                            animate={{
                                scale: voiceState === 'listening' ? [1, 1.05, 1] : 1,
                            }}
                            transition={{
                                duration: 1.5,
                                repeat: voiceState === 'listening' ? Infinity : 0,
                                ease: 'easeInOut',
                            }}
                            whileTap={{ scale: 0.95 }}
                        >
                            {voiceState === 'processing' ? (
                                <Loader2 className="h-12 w-12 text-white animate-spin" />
                            ) : (
                                <Mic className="h-12 w-12 text-white" />
                            )}
                        </motion.div>
                    </div>

                    {/* Status text */}
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="mt-12 text-2xl font-medium"
                        style={{ fontFamily: 'Montserrat, sans-serif', color: '#1f2937' }}
                    >
                        {getStatusText()}
                    </motion.p>

                    {/* Transcription display */}
                    {transcription && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-6 max-w-md text-center"
                        >
                            <p className="text-sm" style={{ color: '#6b7280' }}>You said:</p>
                            <p className="mt-1" style={{ color: '#374151' }}>{transcription}</p>
                        </motion.div>
                    )}

                    {/* AI response display */}
                    {aiResponse && voiceState === 'speaking' && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-4 max-w-md text-center"
                        >
                            <p className="text-orange-500 text-sm font-medium">AI:</p>
                            <p className="mt-1 text-sm" style={{ color: '#374151' }}>{aiResponse}</p>
                        </motion.div>
                    )}

                    {/* Hint text */}
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="absolute bottom-12 text-sm"
                        style={{ color: '#6b7280' }}
                    >
                        {voiceState === 'listening'
                            ? 'Speak naturally — I\'ll respond when you pause'
                            : 'Having a conversation with CommonPlate AI'}
                    </motion.p>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
