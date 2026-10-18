# 構成図

使用している主な技術を、アプリ・データ管理・メール・動画の4つにまとめています。

- [PNG画像](architecture.png)：資料への貼り付け用
- [SVG画像](architecture.svg)：拡大しても鮮明な画像
- [Mermaidソース](architecture.mmd)：編集用

![アプリと各サービスの関係](architecture.svg)

## Mermaid記法

[Mermaid Live Editor](https://mermaid.live/)に貼り付けて、編集や画像の保存ができます。

```mermaid
---
config:
  theme: base
  themeCSS: '.edgeLabel .background { fill: #FFFFFF; opacity: 1; }'
  layout: dagre
  htmlLabels: false
  themeVariables:
    fontFamily: '"IPAexGothic", "Noto Sans CJK JP", "Yu Gothic", "Meiryo", sans-serif'
    fontSize: 20px
    primaryTextColor: '#16324F'
    lineColor: '#64748B'
    edgeLabelBackground: '#FFFFFF'
    background: '#FFFFFF'
  flowchart:
    htmlLabels: false
    curve: basis
    nodeSpacing: 48
    rankSpacing: 64
    padding: 20
    wrappingWidth: 380
    useMaxWidth: false
---
flowchart LR
  accTitle: アプリと各サービスの関係
  accDescr: React NativeとExpoで作ったアプリがSupabaseでログインとデータ管理を行う。Supabaseから招待メールを送り、アプリにはYouTubeの動画を表示する。

  APP["アプリ<br/>React Native + Expo<br/>TypeScript"]
  SUPABASE["ログイン・データ管理<br/>Supabase"]
  MAIL["招待メール"]
  YOUTUBE["動画再生<br/>YouTube"]

  APP <-->|ログイン・データ連携| SUPABASE
  SUPABASE -->|メールを送る| MAIL
  APP -->|動画を表示| YOUTUBE

  classDef app fill:#006194,stroke:#006194,color:#FFFFFF,stroke-width:2px
  classDef backend fill:#EAF7EF,stroke:#70BA95,color:#164E38,stroke-width:2px
  classDef external fill:#FFF8ED,stroke:#D5B883,color:#563D1F,stroke-width:2px
  class APP app;
  class SUPABASE backend;
  class MAIL,YOUTUBE external;
```
