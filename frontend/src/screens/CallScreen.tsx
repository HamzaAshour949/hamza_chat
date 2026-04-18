import React from 'react';
import { View, Text, Pressable, StyleSheet, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RTCView, MediaStream } from 'react-native-webrtc';

type CallState = 'outgoing' | 'incoming' | 'connected';
type CallType = 'voice' | 'video';

interface CallScreenProps {
  callState: CallState;
  callType: CallType;
  remoteEmail: string;
  callDuration: number;
  isMuted: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function CallScreen({
  callState,
  callType,
  remoteEmail,
  callDuration,
  isMuted,
  localStream,
  remoteStream,
  onAccept,
  onReject,
  onEnd,
  onToggleMute,
}: CallScreenProps) {
  const isVideo = callType === 'video';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Remote video (full screen) */}
      {isVideo && remoteStream && (
        <RTCView
          streamURL={remoteStream.toURL()}
          style={styles.remoteVideo}
          objectFit="cover"
        />
      )}

      {/* Local video PiP */}
      {isVideo && localStream && (
        <View style={styles.localVideoPip}>
          <RTCView
            streamURL={localStream.toURL()}
            style={styles.localVideo}
            objectFit="cover"
            mirror
          />
        </View>
      )}

      {/* Overlay content */}
      <View style={styles.overlay}>
        {/* Top: caller info */}
        <View style={styles.topInfo}>
          {!isVideo && (
            <View style={styles.avatar}>
              <Ionicons name="person" size={64} color="#8696A0" />
            </View>
          )}
          <Text style={styles.callerName}>{remoteEmail}</Text>
          <Text style={styles.statusText}>
            {callState === 'outgoing' && 'Calling...'}
            {callState === 'incoming' && `Incoming ${callType} call`}
            {callState === 'connected' && formatDuration(callDuration)}
          </Text>
        </View>

        {/* Bottom: action buttons */}
        <View style={styles.bottomButtons}>
          {callState === 'incoming' ? (
            <View style={styles.incomingRow}>
              <View style={styles.btnWrapper}>
                <Pressable
                  onPress={onReject}
                  style={[styles.roundBtn, styles.redBtn]}
                  accessibilityLabel="Reject call"
                >
                  <Ionicons
                    name="call"
                    size={30}
                    color="#fff"
                    style={{ transform: [{ rotate: '135deg' }] }}
                  />
                </Pressable>
                <Text style={styles.btnLabel}>Decline</Text>
              </View>
              <View style={styles.btnWrapper}>
                <Pressable
                  onPress={onAccept}
                  style={[styles.roundBtn, styles.greenBtn]}
                  accessibilityLabel="Accept call"
                >
                  <Ionicons name="call" size={30} color="#fff" />
                </Pressable>
                <Text style={styles.btnLabel}>Accept</Text>
              </View>
            </View>
          ) : (
            <View style={styles.activeRow}>
              <View style={styles.btnWrapper}>
                <Pressable
                  onPress={onToggleMute}
                  style={[styles.smallRoundBtn, isMuted && styles.activeSmallBtn]}
                  accessibilityLabel={isMuted ? 'Unmute' : 'Mute'}
                >
                  <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={24} color="#fff" />
                </Pressable>
                <Text style={styles.btnLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
              </View>
              <View style={styles.btnWrapper}>
                <Pressable
                  onPress={onEnd}
                  style={[styles.roundBtn, styles.redBtn]}
                  accessibilityLabel="End call"
                >
                  <Ionicons
                    name="call"
                    size={30}
                    color="#fff"
                    style={{ transform: [{ rotate: '135deg' }] }}
                  />
                </Pressable>
                <Text style={styles.btnLabel}>End</Text>
              </View>
              <View style={styles.btnWrapper}>
                <View style={styles.smallRoundBtn}>
                  <Ionicons name="volume-high" size={24} color="#fff" />
                </View>
                <Text style={styles.btnLabel}>Speaker</Text>
              </View>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#111B21',
    zIndex: 999,
  },
  remoteVideo: {
    ...StyleSheet.absoluteFillObject,
  },
  localVideoPip: {
    position: 'absolute',
    top: 60,
    right: 16,
    width: 100,
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    zIndex: 10,
    borderWidth: 2,
    borderColor: '#1F2C33',
  },
  localVideo: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingTop: 100,
    paddingBottom: 60,
  },
  topInfo: {
    alignItems: 'center',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1F2C33',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  callerName: {
    color: '#E9EDEF',
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  statusText: {
    color: '#8696A0',
    fontSize: 16,
  },
  bottomButtons: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  incomingRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    width: '100%',
  },
  btnWrapper: {
    alignItems: 'center',
  },
  roundBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  redBtn: {
    backgroundColor: '#F15C6D',
  },
  greenBtn: {
    backgroundColor: '#00A884',
  },
  smallRoundBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeSmallBtn: {
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  btnLabel: {
    color: '#8696A0',
    fontSize: 11,
    marginTop: 6,
  },
});
