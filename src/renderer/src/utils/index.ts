/**
 * 合并视频流（可能自带音频）和额外音频流
 * @param videoStream 包含视频轨道，可选音频轨道
 * @param extraAudioStream 额外音频流（如麦克风）
 * @returns 合并后的 MediaStream
 */
export function mergeVideoAndAudioStreams(
  videoStream: MediaStream,
  extraAudioStream?: MediaStream
): MediaStream {
  const audioContext = new AudioContext()
  const destination = audioContext.createMediaStreamDestination()

  // 1. 视频流中的音频轨道（如果有）混入
  const videoAudioTracks = videoStream.getAudioTracks()
  if (videoAudioTracks.length > 0) {
    const videoAudioSource = audioContext.createMediaStreamSource(new MediaStream(videoAudioTracks))
    videoAudioSource.connect(destination)
  }

  // 2. 额外音频流混入
  if (extraAudioStream) {
    const extraAudioTracks = extraAudioStream.getAudioTracks()
    if (extraAudioTracks.length > 0) {
      const extraAudioSource = audioContext.createMediaStreamSource(
        new MediaStream(extraAudioTracks)
      )
      extraAudioSource.connect(destination)
    }
  }

  // 3. 构建最终流
  const combinedStream = new MediaStream()

  // 视频轨道直接加
  videoStream.getVideoTracks().forEach((track) => combinedStream.addTrack(track))

  // 混合后的音频轨道加
  destination.stream.getAudioTracks().forEach((track) => combinedStream.addTrack(track))

  return combinedStream
}
