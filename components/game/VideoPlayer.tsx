import { SkipBack, Pause, Play, SkipForward } from 'lucide-react';

interface VideoPlayerProps {
  playerId: string;
  playerRef: React.MutableRefObject<any>;
  isGameMaster: boolean;
  roomId: number | null;
  videoIndex: number;
  socket: any;
}

export default function VideoPlayer({
  playerId,
  playerRef,
  isGameMaster,
  roomId,
  videoIndex,
  socket,
}: VideoPlayerProps) {
  return (
    <div className="bg-zinc-900/60 backdrop-blur border border-zinc-800/60 rounded-xl overflow-hidden">
      <div className="aspect-video bg-black relative">
        <div id={playerId} className="w-full h-full"></div>
        {/* Couche transparente pour bloquer les clics sur la vidéo */}
        <div className="absolute inset-0 pointer-events-auto bg-transparent"></div>
      </div>

      {/* Contrôles vidéo pour le maître du jeu */}
      {isGameMaster && (
        <div className="bg-zinc-800/50 p-3 border-b border-zinc-700/50">
          <div className="flex flex-wrap gap-2 items-center justify-center">
            <button
              onClick={() => {
                const player = playerRef.current;
                if (player && player.getCurrentTime && player.seekTo) {
                  const currentTime = player.getCurrentTime();
                  const newTime = Math.max(0, currentTime - 10);
                  player.seekTo(newTime, true);
                  socket?.emit('video_seek', { roomId, videoIndex, timestamp: newTime });
                }
              }}
              className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-xs rounded transition-colors cursor-pointer flex items-center gap-1.5"
              title="Reculer de 10s"
            >
              <SkipBack className="w-3.5 h-3.5" />
              <span>-10s</span>
            </button>
            <button
              onClick={() => {
                const player = playerRef.current;
                if (player && player.getCurrentTime && player.pauseVideo) {
                  const currentTime = player.getCurrentTime();
                  player.pauseVideo();
                  socket?.emit('video_pause', { roomId, videoIndex, timestamp: currentTime });
                }
              }}
              className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-xs rounded transition-colors cursor-pointer flex items-center gap-1.5"
              title="Pause"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Pause</span>
            </button>
            <button
              onClick={() => {
                const player = playerRef.current;
                if (player && player.getCurrentTime && player.playVideo) {
                  const currentTime = player.getCurrentTime();
                  player.playVideo();
                  socket?.emit('video_play', { roomId, videoIndex, timestamp: currentTime });
                }
              }}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded transition-colors cursor-pointer flex items-center gap-1.5"
              title="Lecture"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Play</span>
            </button>
            <button
              onClick={() => {
                const player = playerRef.current;
                if (player && player.getCurrentTime && player.seekTo) {
                  const currentTime = player.getCurrentTime();
                  const newTime = currentTime + 10;
                  player.seekTo(newTime, true);
                  socket?.emit('video_seek', { roomId, videoIndex, timestamp: newTime });
                }
              }}
              className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-xs rounded transition-colors cursor-pointer flex items-center gap-1.5"
              title="Avancer de 10s"
            >
              <SkipForward className="w-3.5 h-3.5" />
              <span>+10s</span>
            </button>
            <select
              onChange={(e) => {
                const player = playerRef.current;
                const rate = parseFloat(e.target.value);
                if (player && player.setPlaybackRate) {
                  player.setPlaybackRate(rate);
                  socket?.emit('video_rate_change', { roomId, videoIndex, playbackRate: rate });
                }
              }}
              className="px-2 py-1.5 bg-zinc-700 text-white text-xs rounded cursor-pointer"
              defaultValue="1"
            >
              <option value="0.5">0.5x</option>
              <option value="1">1x</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
              <option value="2">2x</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
