/* SunPy 学習支援 — 設定とドメイン知識 */
window.CFG = {
  appName: "SunPy 学習支援",
  version: "0.1.0",
  model: "claude-sonnet-4-6",
  endpoint: "https://api.anthropic.com/v1/messages",
  maxTokens: 1000,

  /* Gate B の到達段階（Lv1 観察 → Lv5 修正） */
  levels: [
    { n: 1, name: "観察",   desc: "エラーの表層を読む" },
    { n: 2, name: "切り分け", desc: "原因の範囲を狭める" },
    { n: 3, name: "仮説",   desc: "原因を言葉にする" },
    { n: 4, name: "検証",   desc: "確かめる手順を組む" },
    { n: 5, name: "修正",   desc: "直し方と再発防止" }
  ],

  /* SunPy エコシステム。detect は traceback からの自動判定に使う */
  packages: [
    { id: "sunpy", label: "sunpy", area: "コア（Map / TimeSeries / Fido / 座標系 / 単位）",
      detect: ["sunpy.", "import sunpy", "GenericMap", "Fido", "sunpy/map", "sunpy\\map"],
      pitfalls: "Map の作成に必要な FITS ヘッダ欠落、astropy.units を付け忘れた数値、Helioprojective / HeliographicStonyhurst / obstime の指定漏れ、Fido.search と Fido.fetch の戻り値の取り違え、submap への Quantity ではなく素の pixel 値、非推奨 API（sunpy.instr など）の削除、drms/zeep など任意依存の未導入" },
    { id: "aiapy", label: "aiapy", area: "SDO/AIA の較正（PSF・応答・劣化補正・ポインティング）",
      detect: ["aiapy"],
      pitfalls: "update_pointing / register の順序、劣化補正 correct_degradation に必要な較正バージョンとネットワーク取得、level 1 と 1.5 の取り違え、psf.deconvolve の GPU/cupy 依存、Map ではなく ndarray を渡す誤り" },
    { id: "sunpy-soar", label: "sunpy-soar", area: "Solar Orbiter アーカイブ（Fido クライアント）",
      detect: ["sunpy_soar", "sunpy-soar", "soar"],
      pitfalls: "import sunpy_soar を書かずに a.Instrument が解決されない、Level 属性（L1/L2）や Product 属性の指定漏れ、SOAR 側のレスポンス変化" },
    { id: "drms", label: "drms", area: "JSOC / DRMS へのクエリとエクスポート",
      detect: ["drms"],
      pitfalls: "JSOC 登録メールアドレスの未設定、export のプロトコル（as-is / fits）取り違え、レコードセット文字列の書式ミス、待ち時間とタイムアウト" },
    { id: "ndcube", label: "ndcube", area: "N 次元データキューブと WCS",
      detect: ["ndcube"],
      pitfalls: "data と wcs の次元不一致、crop / crop_by_values の単位、NDCube と NDCubeSequence の混同、軸順序（配列順 vs WCS 順）" },
    { id: "irispy-lmsal", label: "irispy-lmsal", area: "IRIS のラスタ・SJI データ",
      detect: ["irispy", "irispy_lmsal"],
      pitfalls: "read_files に渡すファイル種別の取り違え、SJI と raster の混同、ndcube 由来の軸・単位の扱い" },
    { id: "xrtpy", label: "xrtpy", area: "Hinode/XRT の温度応答・フィルタ",
      detect: ["xrtpy"],
      pitfalls: "フィルタ名の綴りと組み合わせ、温度応答の日付依存（汚染層厚）、Map への適用前の前処理不足" },
    { id: "sunkit-image", label: "sunkit-image", area: "画像処理（MGN, RDP, trace, enhance）",
      detect: ["sunkit_image", "sunkit-image"],
      pitfalls: "Map ではなく配列を渡す、NaN の混入、多重スケール処理のパラメータ範囲" },
    { id: "sunkit-instruments", label: "sunkit-instruments", area: "GOES/RHESSI などの機器別処理",
      detect: ["sunkit_instruments"],
      pitfalls: "GOES クラス分けの入力単位、TimeSeries の列名変更" },
    { id: "sunkit-magex", label: "sunkit-magex", area: "PFSS など磁場外挿（旧 pfsspy）",
      detect: ["sunkit_magex", "pfsspy"],
      pitfalls: "入力磁場マップの解像度と sin(latitude) グリッド、境界条件、pfsspy からの移行に伴う import 変更" },
    { id: "sunkit-pyvista", label: "sunkit-pyvista", area: "3D 可視化",
      detect: ["sunkit_pyvista"],
      pitfalls: "ヘッドレス環境での描画バックエンド、座標系の変換漏れ" },
    { id: "solarmach", label: "solarmach", area: "惑星間磁力線の配置図",
      detect: ["solarmach"],
      pitfalls: "日時書式、太陽風速度の単位、天体名の指定" },
    { id: "sunraster", label: "sunraster", area: "分光ラスタデータ",
      detect: ["sunraster"],
      pitfalls: "SpectrogramCube の軸順、露光時間補正の二重適用" },
    { id: "dkist", label: "dkist", area: "DKIST データセット",
      detect: ["dkist"],
      pitfalls: "非同期ダウンロード（Globus）の設定、遅延読み込み配列への直接演算" },
    { id: "roentgen", label: "roentgen", area: "X 線の物質相互作用",
      detect: ["roentgen"],
      pitfalls: "元素・化合物名の指定、エネルギー範囲外の外挿" },
    { id: "other", label: "その他 / 不明", area: "エコシステム外、または判別不能",
      detect: [], pitfalls: "astropy, numpy, matplotlib, parfive など周辺ライブラリのバージョン不整合" }
  ],

  /* 出典の既定候補（捏造防止のため、確実なものだけを提示する） */
  canonicalRefs: [
    { title: "sunpy Documentation", url: "https://docs.sunpy.org/" },
    { title: "The SunPy Project: Open Source Development and Status of the Version 1.0 Core Package", url: "https://doi.org/10.3847/1538-4357/ab4f7a" },
    { title: "SunPy Affiliated Packages", url: "https://sunpy.org/packages" }
  ]
};
