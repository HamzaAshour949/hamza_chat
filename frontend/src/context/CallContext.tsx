import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { getSocket } from '../services/socket';
import {
  createPeerConnection,
  getLocalStream,
  RTCSessionDescription,
  RTCIceCandidate,
  MediaStream,
  RTCPeerConnection,
  isWebRTCAvailable,
} from '../services/webrtc';
import CallScreen from '../screens/CallScreen';

type CallState = 'idle' | 'outgoing' | 'incoming' | 'connected';
type CallType = 'voice' | 'video';

interface CallContextValue {
  callState: CallState;
  startCall: (userId: number, email: string, type: CallType) => void;
}

const CallContext = createContext<CallContextValue>({
  callState: 'idle',
  startCall: () => {},
});

export const useCall = () => useContext(CallContext);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const [callState, setCallState] = useState<CallState>('idle');
  const [callType, setCallType] = useState<CallType>('voice');
  const [remoteUserId, setRemoteUserId] = useState<number | null>(null);
  const [remoteEmail, setRemoteEmail] = useState('');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  // Refs for stable access in socket callbacks (no stale closures)
  const callStateRef = useRef<CallState>('idle');
  const callTypeRef = useRef<CallType>('voice');
  const remoteUserIdRef = useRef<number | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingOfferRef = useRef<any>(null);
  const pendingCandidatesRef = useRef<any[]>([]);

  // Keep refs in sync with state
  callStateRef.current = callState;
  callTypeRef.current = callType;
  remoteUserIdRef.current = remoteUserId;

  const cleanup = useCallback(() => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    localStreamRef.current?.getTracks().forEach((t: any) => t.stop());
    localStreamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    pendingOfferRef.current = null;
    pendingCandidatesRef.current = [];

    setLocalStream(null);
    setRemoteStream(null);
    setCallState('idle');
    setCallDuration(0);
    setIsMuted(false);
    setRemoteUserId(null);
    setRemoteEmail('');
    callStateRef.current = 'idle';
    remoteUserIdRef.current = null;
  }, []);

  const setupPC = useCallback(
    (stream: MediaStream, targetId: number): RTCPeerConnection => {
      const pc = createPeerConnection();
      pcRef.current = pc;

      stream.getTracks().forEach((track: any) => pc.addTrack(track, stream));

      pc.onicecandidate = (e: any) => {
        if (e.candidate) {
          getSocket()?.emit('ice_candidate', {
            to: targetId,
            candidate: e.candidate,
          });
        }
      };

      pc.ontrack = (e: any) => {
        if (e.streams?.[0]) {
          setRemoteStream(e.streams[0] as MediaStream);
        }
      };

      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        if (state === 'connected' || state === 'completed') {
          setCallState('connected');
          callStateRef.current = 'connected';
          if (!durationTimerRef.current) {
            durationTimerRef.current = setInterval(
              () => setCallDuration((d) => d + 1),
              1000,
            );
          }
        } else if (state === 'disconnected' || state === 'failed') {
          cleanup();
        }
      };

      return pc;
    },
    [cleanup],
  );

  // Start an outgoing call
  const startCall = useCallback(
    async (userId: number, email: string, type: CallType) => {
      if (callStateRef.current !== 'idle') return;

      setCallType(type);
      callTypeRef.current = type;
      setRemoteUserId(userId);
      remoteUserIdRef.current = userId;
      setRemoteEmail(email);
      setCallState('outgoing');
      callStateRef.current = 'outgoing';

      try {
        const stream = await getLocalStream(type === 'video');
        localStreamRef.current = stream as MediaStream;
        setLocalStream(stream as MediaStream);

        const pc = setupPC(stream as MediaStream, userId);
        const offer = await pc.createOffer({});
        await pc.setLocalDescription(offer);

        getSocket()?.emit('call_offer', {
          to: userId,
          offer: { type: offer.type, sdp: offer.sdp },
          callType: type,
        });
      } catch (e) {
        console.error('Failed to start call:', e);
        cleanup();
      }
    },
    [setupPC, cleanup],
  );

  // Accept an incoming call
  const acceptCall = useCallback(async () => {
    if (
      callStateRef.current !== 'incoming' ||
      !remoteUserIdRef.current ||
      !pendingOfferRef.current
    )
      return;

    const targetId = remoteUserIdRef.current;

    try {
      const isVideo = callTypeRef.current === 'video';
      const stream = await getLocalStream(isVideo);
      localStreamRef.current = stream as MediaStream;
      setLocalStream(stream as MediaStream);

      const pc = setupPC(stream as MediaStream, targetId);

      await pc.setRemoteDescription(
        new RTCSessionDescription(pendingOfferRef.current),
      );
      pendingOfferRef.current = null;

      for (const candidate of pendingCandidatesRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingCandidatesRef.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      getSocket()?.emit('call_answer', {
        to: targetId,
        answer: { type: answer.type, sdp: answer.sdp },
      });
    } catch (e) {
      console.error('Failed to accept call:', e);
      cleanup();
    }
  }, [setupPC, cleanup]);

  const rejectCall = useCallback(() => {
    if (remoteUserIdRef.current) {
      getSocket()?.emit('call_reject', { to: remoteUserIdRef.current });
    }
    cleanup();
  }, [cleanup]);

  const endCall = useCallback(() => {
    if (remoteUserIdRef.current) {
      getSocket()?.emit('call_end', { to: remoteUserIdRef.current });
    }
    cleanup();
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  }, []);

  // Socket event listeners
  useEffect(() => {
    let socket = getSocket();
    let attached = false;

    function onCallOffer(data: any) {
      if (callStateRef.current !== 'idle') {
        getSocket()?.emit('call_reject', { to: data.from });
        return;
      }
      pendingOfferRef.current = data.offer;
      pendingCandidatesRef.current = [];
      setCallType(data.callType || 'voice');
      callTypeRef.current = data.callType || 'voice';
      setRemoteUserId(data.from);
      remoteUserIdRef.current = data.from;
      setRemoteEmail(data.fromEmail || `User ${data.from}`);
      setCallState('incoming');
      callStateRef.current = 'incoming';
    }

    async function onCallAnswer(data: any) {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(
          new RTCSessionDescription(data.answer),
        );
        for (const candidate of pendingCandidatesRef.current) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
        pendingCandidatesRef.current = [];
      } catch (e) {
        console.error('Error handling call answer:', e);
      }
    }

    async function onIceCandidate(data: any) {
      const pc = pcRef.current;
      if (pc?.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.error('Error adding ICE candidate:', e);
        }
      } else {
        pendingCandidatesRef.current.push(data.candidate);
      }
    }

    function onCallEnded() {
      cleanup();
    }
    function onCallRejected() {
      cleanup();
    }
    function onCallUnavailable() {
      cleanup();
    }
    function onUserOffline(data: any) {
      if (
        data.userId === remoteUserIdRef.current &&
        callStateRef.current !== 'idle'
      ) {
        cleanup();
      }
    }

    function attach(s: any) {
      if (attached) return;
      attached = true;
      s.on('call_offer', onCallOffer);
      s.on('call_answer', onCallAnswer);
      s.on('ice_candidate', onIceCandidate);
      s.on('call_ended', onCallEnded);
      s.on('call_rejected', onCallRejected);
      s.on('call_unavailable', onCallUnavailable);
      s.on('user_offline', onUserOffline);
    }

    if (socket) {
      attach(socket);
    }

    const interval = !socket
      ? setInterval(() => {
          socket = getSocket();
          if (socket) {
            clearInterval(interval!);
            attach(socket);
          }
        }, 300)
      : null;

    return () => {
      if (interval) clearInterval(interval);
      if (socket && attached) {
        socket.off('call_offer', onCallOffer);
        socket.off('call_answer', onCallAnswer);
        socket.off('ice_candidate', onIceCandidate);
        socket.off('call_ended', onCallEnded);
        socket.off('call_rejected', onCallRejected);
        socket.off('call_unavailable', onCallUnavailable);
        socket.off('user_offline', onUserOffline);
      }
    };
  }, [cleanup]);

  return (
    <CallContext.Provider value={{ callState, startCall }}>
      {children}
      {callState !== 'idle' && (
        <CallScreen
          callState={callState}
          callType={callType}
          remoteEmail={remoteEmail}
          callDuration={callDuration}
          isMuted={isMuted}
          localStream={localStream}
          remoteStream={remoteStream}
          onAccept={acceptCall}
          onReject={rejectCall}
          onEnd={endCall}
          onToggleMute={toggleMute}
        />
      )}
    </CallContext.Provider>
  );
}
