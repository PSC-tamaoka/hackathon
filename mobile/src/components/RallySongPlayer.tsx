import { useState } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import { AppText } from "./AppText";
import { rallySong } from "../constants/rallyMedia";

export function RallySongPlayer() {
  const [failed, setFailed] = useState(false);
  if (failed) return <AppText>動画を読み込めませんでした。閉じてから再度お試しください。</AppText>;
  return (
    <View style={{ width: "100%", aspectRatio: 16 / 9, minHeight: 200 }}>
      <WebView
        style={{ flex: 1, backgroundColor: "#000" }}
        source={{
          baseUrl: "https://localhost",
          html: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#player{margin:0;width:100%;height:100%;background:#000}</style></head><body><div id="player"></div><script src="https://www.youtube.com/iframe_api"></script><script>function onYouTubeIframeAPIReady(){new YT.Player('player',{videoId:'${rallySong.videoId}',playerVars:{playsinline:1,origin:'https://localhost'},events:{onError:function(){window.ReactNativeWebView.postMessage('error')}}})}</script></body></html>`,
        }}
        originWhitelist={["https://*"]}
        allowsInlineMediaPlayback
        allowsFullscreenVideo={false}
        mediaPlaybackRequiresUserAction
        onError={() => setFailed(true)}
        onHttpError={() => setFailed(true)}
        onMessage={(message) => { if (message.nativeEvent.data === "error") setFailed(true); }}
      />
    </View>
  );
}
