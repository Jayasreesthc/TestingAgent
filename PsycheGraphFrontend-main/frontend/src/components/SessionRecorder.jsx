import { useState, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { createSession } from '../store/slices/SessionSlice';
import { Mic, Square, Save, FileAudio, Loader2, X } from 'lucide-react';

export default function SessionRecorder({ patientId, onClose }) {
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState(null);
    const [loading, setLoading] = useState(false);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const dispatch = useDispatch();

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            chunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/wav' });
                setAudioBlob(blob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (err) {
            console.error('Error accessing microphone:', err);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const handleSave = async () => {
        if (!audioBlob) return;
        setLoading(true);
        const formData = new FormData();
        formData.append('patient_id', patientId);
        formData.append('file', audioBlob, `session_${Date.now()}.wav`);

        try {
            await dispatch(createSession(formData)).unwrap();
            onClose();
        } catch (err) {
            console.error('Upload failed:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-xl font-bold text-slate-900">New Session</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-8 flex flex-col items-center gap-8">
                    <div className={`p-8 rounded-full transition-all duration-300 ${isRecording ? 'bg-red-50 text-red-600 scale-110' : 'bg-primary-50 text-primary-600'}`}>
                        <FileAudio size={64} />
                    </div>

                    <div className="text-center">
                        <h4 className="font-bold text-slate-900 text-lg">
                            {isRecording ? 'Recording in progress...' : audioBlob ? 'Recording complete' : 'Ready to record'}
                        </h4>
                        <p className="text-slate-500 mt-1">
                            Capture your session with the patient securely.
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        {!audioBlob && !isRecording && (
                            <button
                                onClick={startRecording}
                                className="flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-full font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-200"
                            >
                                <Mic size={20} />
                                <span>Start Recording</span>
                            </button>
                        )}

                        {isRecording && (
                            <button
                                onClick={stopRecording}
                                className="flex items-center gap-2 bg-red-600 text-white px-6 py-3 rounded-full font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200 animate-pulse"
                            >
                                <Square size={20} />
                                <span>Stop Recording</span>
                            </button>
                        )}

                        {audioBlob && !isRecording && !loading && (
                            <div className="flex flex-col gap-4 w-full">
                                <audio src={URL.createObjectURL(audioBlob)} controls className="w-full" />
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => setAudioBlob(null)}
                                        className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-semibold hover:bg-slate-50"
                                    >
                                        Discard
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-emerald-700 shadow-lg shadow-emerald-200"
                                    >
                                        <Save size={18} />
                                        <span>Upload Session</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {loading && (
                            <div className="flex items-center gap-3 text-primary-600 font-bold">
                                <Loader2 className="animate-spin" />
                                <span>Processing session...</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
