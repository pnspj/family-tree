# Builds app/public/guide.html: how the app works, protecting personal information, and the rules
# for exported JSON files (own backups only). Children's text is written as {漢字|よみ} and becomes
# <ruby>; notes for adults are plain HTML. Run:  python3 tools/build_guide.py
import re
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / 'app/public/guide.html'

# ---- furigana ------------------------------------------------------------------------------
RT_SCALE = 0.5  # rt font-size relative to the base text


def _neighbor_is_ruby(s: str, i: int, step: int) -> bool:
    """Whether the nearest text character (skipping tags) before/after index i closes/opens a ruby token."""
    j = i
    while 0 <= j < len(s):
        c = s[j]
        if c == '>' and step < 0:
            j = s.rfind('<', 0, j) - 1
            continue
        if c == '<' and step > 0:
            j = s.find('>', j) + 1
            continue
        return c == ('}' if step < 0 else '{')
    return False


def r(s: str) -> str:
    """{漢字|よみ} -> <ruby>. A reading wider than its kanji overhangs onto neighbouring kana
    (never onto another reading); the kanji stay together via ruby-align: center."""
    out, last = [], 0
    for m in re.finditer(r'\{([^|{}]+)\|([^{}]+)\}', s):
        out.append(s[last:m.start()])
        base, reading = m.group(1), m.group(2)
        excess = len(reading) * RT_SCALE - len(base)
        style = ''
        if excess > 0:
            x = min(excess / 2, 0.75)
            parts = []
            if not _neighbor_is_ruby(s, m.start() - 1, -1):
                parts.append(f'margin-left:-{x:g}em')
            if not _neighbor_is_ruby(s, m.end(), 1):
                parts.append(f'margin-right:-{x:g}em')
            if parts:
                style = ' style="' + ';'.join(parts) + '"'
        out.append(f'<ruby{style}>{base}<rt>{reading}</rt></ruby>')
        last = m.end()
    out.append(s[last:])
    return ''.join(out)


def h2(id_, n, title):
    return f'<h2 id="{id_}"><span class="num">{n}</span>{r(title)}</h2>'


def p(text, cls=''):
    return f'<p{f" class={chr(34)}{cls}{chr(34)}" if cls else ""}>{r(text)}</p>'


def point(text):
    return f'<div class="point">{r(text)}</div>'


def figure(svg, caption):
    return f'<figure>\n{svg.strip()}\n<figcaption>{r(caption)}</figcaption>\n</figure>'


def adult(items):
    lis = '\n'.join(f'<li>{x}</li>' for x in items)
    return f'<details class="adult"><summary>おとなの かたへ</summary>\n<ul>\n{lis}\n</ul>\n</details>'


def checklist(items):
    lis = []
    for it in items:
        main, *small = it.split('||')
        lis.append(f'<li>{r(main)}' + (f'<small>{r(small[0])}</small>' if small else '') + '</li>')
    return '<ul class="checklist">\n' + '\n'.join(lis) + '\n</ul>'


# ---- diagrams (short kana labels; SVG has no ruby) -------------------------------------------
MARKERS = '''
<defs>
  <marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--blue)" /></marker>
  <marker id="ahr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--red)" /></marker>
  <marker id="aha" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--accent)" /></marker>
</defs>'''

FIG_APP = '''
<svg viewBox="0 0 640 260" role="img" aria-labelledby="f1t">
  <title id="f1t">アプリのサーバーはプログラムだけを届け、家系図のデータはブラウザの中に保存される図</title>''' + MARKERS + '''
  <rect x="20" y="40" width="200" height="170" rx="14" fill="var(--blue-soft)" stroke="var(--blue)" stroke-width="2" />
  <text x="120" y="70" text-anchor="middle" class="d-title">アプリの サーバー</text>
  <text x="120" y="90" text-anchor="middle" class="d-small">（GitHub Pages など）</text>
  <rect x="60" y="110" width="120" height="70" rx="8" fill="#fff" stroke="var(--blue)" />
  <text x="120" y="140" text-anchor="middle" class="d-text">アプリの</text>
  <text x="120" y="160" text-anchor="middle" class="d-text">プログラム</text>
  <rect x="400" y="20" width="220" height="220" rx="18" fill="#fff" stroke="var(--text)" stroke-width="2" />
  <text x="510" y="48" text-anchor="middle" class="d-title">あなたの パソコン・スマホ</text>
  <rect x="420" y="62" width="180" height="160" rx="10" fill="var(--accent-soft)" stroke="var(--accent)" />
  <text x="510" y="86" text-anchor="middle" class="d-text">ブラウザ</text>
  <rect x="440" y="100" width="140" height="56" rx="8" fill="#fff" stroke="var(--accent)" />
  <text x="510" y="124" text-anchor="middle" class="d-text">アプリが うごく</text>
  <text x="510" y="143" text-anchor="middle" class="d-small">（プログラム）</text>
  <rect x="440" y="164" width="140" height="46" rx="8" fill="#fff" stroke="var(--green)" stroke-width="2" />
  <text x="510" y="184" text-anchor="middle" class="d-text">かけいずの データ</text>
  <text x="510" y="202" text-anchor="middle" class="d-small">ここに だけ ほぞん</text>
  <line x1="225" y1="110" x2="395" y2="110" stroke="var(--blue)" stroke-width="3" marker-end="url(#ah)" />
  <text x="310" y="98" text-anchor="middle" class="d-blue">プログラムを とどける</text>
  <line x1="395" y1="180" x2="225" y2="180" stroke="var(--red)" stroke-width="3" stroke-dasharray="7 6" marker-end="url(#ahr)" />
  <text x="310" y="156" text-anchor="middle" class="d-red">データは おくらない</text>
  <g transform="translate(310 180)"><circle r="13" fill="#fff" stroke="var(--red)" stroke-width="3" /><path d="M-6,-6 L6,6 M6,-6 L-6,6" stroke="var(--red)" stroke-width="3" /></g>
</svg>'''

FIG_FILE = '''
<svg viewBox="0 0 640 270" role="img" aria-labelledby="f2t">
  <title id="f2t">書き出すとデータが1つのファイルになり、メモ帳で開くと名前や誕生日がそのまま読める図</title>''' + MARKERS + '''
  <rect x="15" y="60" width="150" height="110" rx="12" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="2" />
  <text x="90" y="92" text-anchor="middle" class="d-title">ブラウザの なか</text>
  <rect x="35" y="108" width="110" height="44" rx="8" fill="#fff" stroke="var(--green)" stroke-width="2" />
  <text x="90" y="135" text-anchor="middle" class="d-text">かけいずの データ</text>
  <line x1="170" y1="115" x2="222" y2="115" stroke="var(--accent)" stroke-width="3" marker-end="url(#aha)" />
  <text x="196" y="100" text-anchor="middle" fill="var(--accent)" font-weight="800" font-size="12">かきだす</text>
  <path d="M230,55 H300 L320,75 V180 H230 Z" fill="#fff" stroke="var(--text)" stroke-width="2" />
  <path d="M300,55 V75 H320" fill="none" stroke="var(--text)" stroke-width="2" />
  <text x="275" y="118" text-anchor="middle" class="d-title">JSON</text>
  <text x="275" y="138" text-anchor="middle" class="d-small">（ジェイソン）</text>
  <text x="275" y="200" text-anchor="middle" class="d-small">ダウンロード フォルダ</text>
  <text x="275" y="218" text-anchor="middle" class="d-small">などに ほぞん</text>
  <line x1="325" y1="115" x2="365" y2="115" stroke="var(--blue)" stroke-width="3" marker-end="url(#ah)" />
  <rect x="372" y="30" width="258" height="185" rx="8" fill="#fff" stroke="var(--muted)" stroke-width="2" />
  <rect x="372" y="30" width="258" height="24" rx="8" fill="#eee9e3" />
  <text x="384" y="47" class="d-small">メモちょう</text>
  <g font-family="ui-monospace, Consolas, monospace" font-size="12.5" fill="var(--text)">
    <text x="384" y="76">"familyName": "山田",</text>
    <text x="384" y="96">"givenName": "蓮",</text>
    <text x="384" y="116">"birth": { "y": 2016,</text>
    <text x="384" y="136">          "m": 7, "d": 7 },</text>
    <text x="384" y="156">"childOf": "u_kenichi2",</text>
    <text x="384" y="176">…</text>
  </g>
  <text x="501" y="240" text-anchor="middle" class="d-red">そのまま よめる（かぎは ない）</text>
</svg>'''

FIG_ROUTE = '''
<svg viewBox="0 0 640 280" role="img" aria-labelledby="f3t">
  <title id="f3t">ファイルはメールやメッセージ、クラウドのサーバーを通って届き、送った人、サーバー、受け取った人の3か所に残る図</title>''' + MARKERS + '''
  <rect x="15" y="60" width="150" height="110" rx="14" fill="#fff" stroke="var(--text)" stroke-width="2" />
  <text x="90" y="92" text-anchor="middle" class="d-title">わたす ひと</text>
  <text x="90" y="116" text-anchor="middle" class="d-text">スマホの なかに</text>
  <text x="90" y="134" text-anchor="middle" class="d-text">ファイルが</text>
  <text x="90" y="156" text-anchor="middle" class="d-red">のこる</text>
  <rect x="245" y="40" width="150" height="150" rx="14" fill="var(--blue-soft)" stroke="var(--blue)" stroke-width="2" />
  <text x="320" y="70" text-anchor="middle" class="d-title">メール・LINE・</text>
  <text x="320" y="90" text-anchor="middle" class="d-title">クラウドの サーバー</text>
  <text x="320" y="120" text-anchor="middle" class="d-text">ファイルが</text>
  <text x="320" y="142" text-anchor="middle" class="d-red">のこる</text>
  <text x="320" y="164" text-anchor="middle" class="d-small">（かいしゃの ひとは</text>
  <text x="320" y="179" text-anchor="middle" class="d-small">みては いけない きまり）</text>
  <rect x="475" y="60" width="150" height="110" rx="14" fill="#fff" stroke="var(--text)" stroke-width="2" />
  <text x="550" y="92" text-anchor="middle" class="d-title">うけとる ひと</text>
  <text x="550" y="116" text-anchor="middle" class="d-text">スマホの なかに</text>
  <text x="550" y="134" text-anchor="middle" class="d-text">ファイルが</text>
  <text x="550" y="156" text-anchor="middle" class="d-red">のこる</text>
  <line x1="168" y1="115" x2="240" y2="115" stroke="var(--blue)" stroke-width="3" marker-end="url(#ah)" />
  <line x1="398" y1="115" x2="470" y2="115" stroke="var(--blue)" stroke-width="3" marker-end="url(#ah)" />
  <line x1="550" y1="172" x2="550" y2="210" stroke="var(--red)" stroke-width="2.5" stroke-dasharray="6 5" marker-end="url(#ahr)" />
  <text x="550" y="234" text-anchor="middle" class="d-red">てんそう？</text>
  <text x="550" y="256" text-anchor="middle" class="d-red">スクリーンショット？</text>
  <text x="320" y="214" text-anchor="middle" class="d-small">この アプリの サーバーは とおらない</text>
</svg>'''

FIG_SNAPSHOT = '''
<svg viewBox="0 0 640 245" role="img" aria-labelledby="f4t">
  <title id="f4t">ファイルは作った時点の写真のようなもので、後で家系図を直しても渡したファイルの中身は変わらない図</title>''' + MARKERS + '''
  <rect x="20" y="30" width="170" height="150" rx="12" fill="#fff" stroke="var(--text)" stroke-width="2" />
  <text x="105" y="58" text-anchor="middle" class="d-title">4がつの かけいず</text>
  <rect x="55" y="80" width="40" height="24" rx="5" fill="var(--blue-soft)" stroke="var(--blue)" /><rect x="115" y="80" width="40" height="24" rx="5" fill="var(--blue-soft)" stroke="var(--blue)" />
  <rect x="85" y="140" width="40" height="24" rx="5" fill="var(--blue-soft)" stroke="var(--blue)" />
  <path d="M95,92 H115 M105,92 V140" stroke="var(--muted)" fill="none" />
  <line x1="200" y1="115" x2="282" y2="115" stroke="var(--accent)" stroke-width="3" marker-end="url(#aha)" />
  <text x="240" y="98" text-anchor="middle" fill="var(--accent)" font-weight="800" font-size="12">かきだす</text>
  <rect x="290" y="55" width="120" height="100" rx="10" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="2" />
  <text x="350" y="92" text-anchor="middle" class="d-title">ひかえ</text>
  <text x="350" y="114" text-anchor="middle" class="d-text">＝4がつの</text>
  <text x="350" y="134" text-anchor="middle" class="d-text">しゃしん</text>
  <rect x="440" y="30" width="180" height="150" rx="12" fill="#fff" stroke="var(--text)" stroke-width="2" />
  <text x="530" y="58" text-anchor="middle" class="d-title">5がつに なおした</text>
  <rect x="465" y="80" width="40" height="24" rx="5" fill="var(--blue-soft)" stroke="var(--blue)" /><rect x="525" y="80" width="40" height="24" rx="5" fill="var(--blue-soft)" stroke="var(--blue)" />
  <rect x="465" y="140" width="40" height="24" rx="5" fill="var(--blue-soft)" stroke="var(--blue)" /><rect x="545" y="140" width="40" height="24" rx="5" fill="var(--green-soft)" stroke="var(--green)" stroke-width="2" />
  <path d="M505,92 H525 M515,92 V122 H485 V140 M515,122 H565 V140" stroke="var(--muted)" fill="none" />
  <text x="565" y="200" text-anchor="middle" class="d-green">ふえた！</text>
  <text x="300" y="230" text-anchor="middle" class="d-red">ひかえの なかみは 4がつの まま</text>
</svg>'''

FIG_FOREVER = '''
<svg viewBox="0 0 640 200" role="img" aria-labelledby="f5t">
  <title id="f5t">一度渡したファイルはコピーされて広がることがあり、渡した人にもアプリにも消せない図</title>
  <rect x="20" y="70" width="120" height="60" rx="12" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="2" />
  <text x="80" y="98" text-anchor="middle" class="d-title">でていった</text>
  <text x="80" y="118" text-anchor="middle" class="d-title">ファイル</text>
  <g fill="#fff" stroke="var(--red)" stroke-width="2">
    <rect x="250" y="20" width="110" height="44" rx="10" /><rect x="250" y="78" width="110" height="44" rx="10" /><rect x="250" y="136" width="110" height="44" rx="10" />
    <rect x="470" y="10" width="110" height="40" rx="10" /><rect x="470" y="60" width="110" height="40" rx="10" /><rect x="470" y="110" width="110" height="40" rx="10" /><rect x="470" y="160" width="110" height="34" rx="10" />
  </g>
  <g class="d-text" text-anchor="middle">
    <text x="305" y="47">あいての スマホ</text><text x="305" y="105">サーバー</text><text x="305" y="163">てんそう</text>
    <text x="525" y="35">コピー</text><text x="525" y="85">スクショ</text><text x="525" y="135">また てんそう</text><text x="525" y="182">…</text>
  </g>
  <g stroke="var(--red)" stroke-width="2" fill="none">
    <path d="M142,100 L246,42" /><path d="M142,100 L246,100" /><path d="M142,100 L246,158" />
    <path d="M362,42 L466,30" /><path d="M362,100 L466,80" /><path d="M362,158 L466,130" /><path d="M362,158 L466,177" />
  </g>
</svg>'''

# ---- content -----------------------------------------------------------------------------------
FIG_PERSONAL = '''
<svg viewBox="0 0 640 250" role="img" aria-labelledby="fpt">
  <title id="fpt">名前、誕生日、住んでいる町、学校などの情報を組み合わせると、誰のことか分かってしまう図</title>''' + MARKERS + '''
  <g fill="#fff" stroke="var(--blue)" stroke-width="2">
    <rect x="20" y="20" width="150" height="44" rx="10" /><rect x="20" y="78" width="150" height="44" rx="10" />
    <rect x="20" y="136" width="150" height="44" rx="10" /><rect x="20" y="194" width="150" height="44" rx="10" />
  </g>
  <g class="d-text" text-anchor="middle">
    <text x="95" y="47">なまえ</text><text x="95" y="105">たんじょうび</text>
    <text x="95" y="163">すんでいる まち</text><text x="95" y="221">がっこう・かぞく</text>
  </g>
  <g stroke="var(--blue)" stroke-width="2.5" fill="none">
    <path d="M172,42 C260,42 280,120 330,125" marker-end="url(#ah)" /><path d="M172,100 C250,100 280,122 330,125" marker-end="url(#ah)" />
    <path d="M172,158 C250,158 280,128 330,128" marker-end="url(#ah)" /><path d="M172,216 C260,216 280,132 330,130" marker-end="url(#ah)" />
  </g>
  <circle cx="420" cy="98" r="26" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="3" />
  <path d="M372,180 C372,116 468,116 468,180 Z" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="3" />
  <text x="420" y="210" text-anchor="middle" class="d-red">だれか わかって しまう！</text>
  <text x="545" y="90" text-anchor="middle" class="d-small">1つ だけなら</text>
  <text x="545" y="108" text-anchor="middle" class="d-small">わからなくても</text>
  <text x="545" y="140" text-anchor="middle" class="d-small">くみあわせると</text>
  <text x="545" y="158" text-anchor="middle" class="d-small">わかる</text>
</svg>'''

TOC = [
    ('app', 'このアプリの{仕組|しく}み'),
    ('personal', '{個人情報|こじんじょうほう}ってなに？'),
    ('family', 'かけいずは{家族|かぞく}みんなの{個人情報|こじんじょうほう}'),
    ('file', '{書|か}き{出|だ}したファイルの{中身|なかみ}'),
    ('route', 'もし{人|ひと}に{渡|わた}したら（なぜ{禁止|きんし}なの？）'),
    ('forever', '{一度|いちど}{出|で}ると、だれにも{消|け}せない'),
    ('danger', 'どんな{危険|きけん}があるの？'),
    ('backup', '{控|ひか}えはその{時|とき}の{写真|しゃしん}'),
    ('rules', 'このアプリの{約束|やくそく}'),
    ('import', '{読|よ}み{込|こ}むときの{注意|ちゅうい}'),
    ('found', 'もしファイルを{受|う}け{取|と}ってしまったら'),
    ('everyday', 'ふだんの{生活|せいかつ}でも{気|き}をつけよう'),
]

body = []
B = body.append
B('<h1>' + r('かけいずの{仕組|しく}みと、{個人情報|こじんじょうほう}を{守|まも}るための{注意|ちゅうい}') + '</h1>')
B(p('このページでは、アプリがどうやって{動|うご}いているか、{家族|かぞく}の{個人情報|こじんじょうほう}をどう{守|まも}るかを、{図|ず}を{使|つか}って{説明|せつめい}します。おうちの{人|ひと}といっしょに、{最後|さいご}まで{読|よ}んでください。', 'lead'))
B('<nav class="toc" aria-label="もくじ">\n<ol>\n' + '\n'.join(f'<li><a href="#{i}">{r(t)}</a></li>' for i, t in TOC) + '\n</ol>\n</nav>')

# 1 app
B(h2('app', 1, TOC[0][1]))
B(p('インターネットには、ものを{届|とど}ける{側|がわ}のコンピューター（<strong>サーバー</strong>）と、それを{受|う}け{取|と}って{使|つか}う{側|がわ}（あなたのパソコンやスマホ。<strong>クライアント</strong>といいます）があります。'))
B(p('このアプリのサーバーが{届|とど}けるのは、アプリの<strong>プログラムだけ</strong>です。あなたが{入|い}れた{名前|なまえ}や{誕生日|たんじょうび}は、サーバーには{送|おく}られず、あなたのパソコンやスマホの<strong>ブラウザの{中|なか}</strong>にだけ{保存|ほぞん}されます。'))
B(figure(FIG_APP, 'サーバーから{届|とど}くのはプログラムだけ。かけいずのデータは、あなたのブラウザの{中|なか}にだけあります。'))
B(p('だから、ほかのパソコンやスマホ、ほかのブラウザでは、あなたのかけいずは{見|み}えません。このアプリは、かけいずを<strong>あなたの{手元|てもと}だけ</strong>で{使|つか}うように{作|つく}られています。'))
B(adult([
    'このアプリは静的サイト（HTML・CSS・JavaScript だけ）として配信され、アカウントもデータ用のサーバーもありません。アクセス解析や Cookie による追跡もしていません。',
    '入力したデータはブラウザの IndexedDB に保存されます。ブラウザのデータを消去すると家系図も消えるため、書き出したファイルが控え（バックアップ）になります。',
    '詳しくは <a href="./privacy.html">プライバシーポリシー</a> をご覧ください。',
]))

# 2 personal
B(h2('personal', 2, TOC[1][1]))
B(p('<strong>{個人情報|こじんじょうほう}</strong>とは、「だれのことか」がわかる{情報|じょうほう}のことです。{名前|なまえ}、{誕生日|たんじょうび}、{住所|じゅうしょ}、{電話|でんわ}{番号|ばんごう}、{顔|かお}{写真|じゃしん}、{通|かよ}っている{学校|がっこう}などがあります。'))
B(p('1つだけではだれのことかわからなくても、いくつか<strong>{組|く}み{合|あ}わせると、だれのことかわかってしまう</strong>ことがあります。'))
B(figure(FIG_PERSONAL, '{情報|じょうほう}は{組|く}み{合|あ}わせると、だれのことか{分|わ}かってしまいます。'))
B(point('{個人情報|こじんじょうほう}は、その{人|ひと}の{大切|たいせつ}なもちものです。{勝手|かって}に{人|ひと}に{教|おし}えたり、インターネットに{書|か}いたりしてはいけません。'))
B(adult([
    '日本の個人情報保護法では、生存する個人に関する情報で、特定の個人を識別できるもの（他の情報と容易に照合して識別できるものを含みます）を「個人情報」としています。',
    '同法の義務の多くは、個人情報を事業に利用する事業者に課されるもので、家庭内での個人的な利用は通常その対象外と考えられています。ただし、法律の対象外であっても、他人の情報を本人の意に反して広めればプライバシーの侵害になり得ます。',
    'この説明は一般的な内容です。具体的な判断が必要な場合は専門家にご相談ください。',
]))

# 3 family
B(h2('family', 3, TOC[2][1]))
B(p('かけいずには、あなただけでなく、お{父|とう}さん・お{母|かあ}さん、きょうだい、おじいさん・おばあさん、おじさん・おばさん、いとこなど、<strong>たくさんの{人|ひと}の{個人情報|こじんじょうほう}</strong>を{入|い}れることができます。'))
B(p('あなたの{情報|じょうほう}はあなたのもの、おばあちゃんの{情報|じょうほう}はおばあちゃんのものです。<strong>{人|ひと}の{情報|じょうほう}は、その{人|ひと}のもの</strong>。だから、{家族|かぞく}のことでも{勝手|かって}に{広|ひろ}めてはいけません。'))
B(checklist([
    '{入|い}れるのは、{必要|ひつよう}なことだけにする||{名前|なまえ}と{生|う}まれた{年|とし}があれば、{十分|じゅうぶん}に{役|やく}に{立|た}ちます。',
    '{入|い}れてもいいか、{家族|かぞく}にも{聞|き}いてみる||「おばあちゃんの{誕生日|たんじょうび}を{入|い}れてもいい？」と{聞|き}くのも{大切|たいせつ}なことです。',
    '{小|ちい}さい{子|こ}どもの{情報|じょうほう}は、とくに{大切|たいせつ}にする||{自分|じぶん}では{守|まも}れない{人|ひと}の{情報|じょうほう}は、まわりの{大人|おとな}が{守|まも}ります。',
]))
B(adult([
    '入力する親族の多くは、このアプリのことを知りません。生存している方の生年月日などは、必要な範囲にとどめ、可能であれば本人の了解を得ることをおすすめします。',
    '亡くなった方の情報は法律上の「個人情報」には当たりませんが、ご遺族のプライバシーに関わることがあります。',
]))

# 4 file
B(h2('file', 4, TOC[3][1]))
B(p('メニューの「JSON（ジェイソン）で{書|か}き{出|だ}す」を{押|お}すと、ブラウザの{中|なか}のかけいずのデータが<strong>1つのファイル</strong>になって、パソコンやスマホに{保存|ほぞん}されます。これは、データが{消|き}えたときのための<strong>{控|ひか}え</strong>や、{自分|じぶん}のパソコンからスマホへの{引|ひ}っ{越|こ}しに{使|つか}います。'))
B(p('このファイルは、だれでも{読|よ}める{文字|もじ}で{書|か}かれています。メモ{帳|ちょう}などで{開|ひら}くと、{名前|なまえ}や{誕生日|たんじょうび}がそのまま{見|み}えます。<strong>かぎはかかっていません</strong>。'))
B(figure(FIG_FILE, 'ファイルを{開|ひら}くと、{家族|かぞく}の{名前|なまえ}や{誕生日|たんじょうび}がそのまま{読|よ}めます。'))
B(point('つまり、このファイルは「{家族|かぞく}みんなの{個人情報|こじんじょうほう}のかたまり」です。{自分|じぶん}だけが{使|つか}う{場所|ばしょ}に、{大切|たいせつ}にしまっておきましょう。'))
B(adult([
    'ファイルは JSON 形式のテキストで、暗号化はされていません。氏名・読み、旧姓、呼び名、性別、生年月日、没年月日、親子・婚姻関係、呼び方の設定がすべて含まれます。',
    'ダウンロードフォルダは、端末の設定によってクラウドに自動で同期されることがあります。保存先にご注意ください。',
]))

# 5 route
B(h2('route', 5, TOC[4][1]))
B(p('このアプリでは、<strong>{書|か}き{出|だ}したファイルを、{家族|かぞく}でもほかの{人|ひと}に{渡|わた}してはいけない</strong>{約束|やくそく}になっています。なぜでしょう。'))
B(p('ファイルをメールやLINEで{送|おく}ったり、クラウド（インターネット{上|じょう}の{保存|ほぞん}{場所|ばしょ}）に{置|お}いたりすると、<strong>その{会社|かいしゃ}のサーバー</strong>を{通|とお}って{届|とど}きます。そして、{途中|とちゅう}のサーバーや、{渡|わた}した{人|ひと}・{受|う}け{取|と}った{人|ひと}のスマホに、<strong>コピーが{残|のこ}ります</strong>。'))
B(figure(FIG_ROUTE, '{渡|わた}すと、{通|とお}ったところにコピーが{残|のこ}ります。{受|う}け{取|と}った{人|ひと}が、さらにほかの{人|ひと}に{渡|わた}すかもしれません。'))

# 6 forever
B(h2('forever', 6, TOC[5][1]))
B(p('{一度|いちど}{出|で}ていったファイルは、{受|う}け{取|と}った{人|ひと}が{転送|てんそう}したり、スクリーンショットを{撮|と}ったりして、どんどん{広|ひろ}がるかもしれません。コピーが{広|ひろ}がると、<strong>あなたにも、このアプリにも、もう{消|け}す{方法|ほうほう}がありません</strong>。'))
B(figure(FIG_FOREVER, 'インターネットに{一度|いちど}{出|で}た{情報|じょうほう}は、{広|ひろ}がると{消|け}せません。'))
B(point('メールやメッセージを{消|け}しても、ほかに{残|のこ}ったコピーは{消|き}えません。だから、はじめから{渡|わた}さないことが、いちばん{確|たし}かな{守|まも}り{方|かた}です。'))

# 7 danger
B(h2('danger', 7, TOC[6][1]))
B(p('かけいずには、{家族|かぞく}みんなの{名前|なまえ}、{誕生日|たんじょうび}、だれとだれが{家族|かぞく}か、といった{情報|じょうほう}がまとめて{入|はい}っています。{知|し}らない{人|ひと}の{手|て}に{渡|わた}ると、こんなことに{使|つか}われるかもしれません。'))
B('<div class="danger">\n'
  + p('<strong>なりすまし・{詐欺|さぎ}</strong>：{家族|かぞく}の{名前|なまえ}を{知|し}っていることを{理由|りゆう}に「おばあちゃんの{知|し}り{合|あ}いです」と{近|ちか}づいたり、{電話|でんわ}で{家族|かぞく}のふりをしたりする。') + '\n'
  + p('<strong>パスワードの{当|あ}てずっぽう</strong>：{誕生日|たんじょうび}や{名前|なまえ}をパスワードに{使|つか}っていると、{当|あ}てられやすくなる。') + '\n'
  + p('<strong>{子|こ}どもをねらう</strong>：{子|こ}どもの{名前|なまえ}や{年齢|ねんれい}を{知|し}って、なれなれしく{話|はな}しかける。') + '\n</div>')

# 8 backup
B(h2('backup', 8, TOC[7][1]))
B(p('{書|か}き{出|だ}した{控|ひか}えは、<strong>{作|つく}った{瞬間|しゅんかん}のかけいずを{写|うつ}した「{写真|しゃしん}」</strong>のようなものです。あとでかけいずを{直|なお}しても、{前|まえ}に{作|つく}った{控|ひか}えの{中身|なかみ}は{変|か}わりません。'))
B(figure(FIG_SNAPSHOT, '{控|ひか}えは、ときどき{書|か}き{出|だ}し{直|なお}しましょう。{古|ふる}い{控|ひか}えは{消|け}しておきましょう。'))
B(checklist([
    '{控|ひか}えは、{自分|じぶん}だけが{使|つか}う{場所|ばしょ}にしまう||{自分|じぶん}のパソコンやUSBメモリなど。みんなで{使|つか}うパソコンや{共有|きょうゆう}フォルダには{置|お}かない。',
    'かけいずを{直|なお}したら、{控|ひか}えも{作|つく}り{直|なお}す',
    'いらなくなった{控|ひか}えは{消|け}す||ダウンロードフォルダに{古|ふる}いファイルが{残|のこ}っていないか{確|たし}かめる。',
]))

# 9 rules
B(h2('rules', 9, TOC[8][1]))
B(p('このアプリには、おうちの{人|ひと}が{同意|どうい}した{利用|りよう}{規約|きやく}（{使|つか}うときのきまり）があります。だいじなところをまとめると、こうなります。'))
B(checklist([
    'おうちの{人|ひと}といっしょに{使|つか}う',
    '{書|か}き{出|だ}したファイルは、{自分|じぶん}の{控|ひか}えと、{自分|じぶん}の{機械|きかい}の{引|ひ}っ{越|こ}しだけに{使|つか}う',
    '<strong>{家族|かぞく}でも、ほかの{人|ひと}にファイルを{渡|わた}さない</strong>||メール、LINE、クラウド、USBメモリ、どんな{方法|ほうほう}でも{渡|わた}さない。',
    'ほかの{人|ひと}が{作|つく}ったファイルは{読|よ}み{込|こ}まない',
    'かけいずの{画面|がめん}を、SNSやインターネットにのせない||スクリーンショットや{写真|しゃしん}でも{同|おな}じです。',
]))
B(adult(['正式な内容は <a href="./terms.html">利用規約・免責事項</a> をご確認ください。とくに第5条（書き出しファイルの取扱い）と第6条（親族等の情報の取扱い）が関係します。']))

# 10 import
B(h2('import', 10, TOC[9][1]))
B(p('メニューの「JSONを{読|よ}み{込|こ}む」は、{自分|じぶん}で{書|か}き{出|だ}した{控|ひか}えを、このブラウザに{戻|もど}す{機能|きのう}です。'))
B(checklist([
    '{自分|じぶん}で{書|か}き{出|だ}したファイルだけを{読|よ}み{込|こ}む||ほかの{人|ひと}から{届|とど}いたファイルは{読|よ}み{込|こ}みません。',
    '{読|よ}み{込|こ}むと、いまのかけいずは{置|お}き{換|か}わります||{元|もと}に{戻|もど}せないので、{先|さき}にいまのかけいずを{書|か}き{出|だ}しておきましょう。',
    '{読|よ}み{込|こ}んだあと、いらなくなったファイルは{消|け}す',
]))
B(adult([
    '読み込むファイルは、データとして検査してから取り込みます。ファイルの中のプログラムが実行されることはありません。形式が違うファイルや、壊れたファイルは読み込みません。',
    '読み込みは、ブラウザに保存されている家系図を丸ごと置き換えます。置き換えた後に元へ戻す機能はありません。',
]))

# 11 found
B(h2('found', 11, TOC[10][1]))
B(p('もし、だれかからかけいずのファイルが{届|とど}いたり、どこかで{見|み}つけたりしたら、こうしましょう。'))
B(checklist([
    '{開|ひら}かない・{読|よ}み{込|こ}まない',
    'ほかの{人|ひと}に{見|み}せない・{転送|てんそう}しない',
    'おうちの{人|ひと}に{伝|つた}える||どうするかは、おうちの{人|ひと}といっしょに{決|き}めましょう。',
    '{必要|ひつよう}がなければ{消|け}す',
]))

# 12 everyday
B(h2('everyday', 12, TOC[11][1]))
B(p('{個人情報|こじんじょうほう}を{守|まも}ることは、このアプリだけの{話|はなし}ではありません。ふだんの{生活|せいかつ}でも{気|き}をつけましょう。'))
B(checklist([
    'インターネットやゲームで、{本当|ほんとう}の{名前|なまえ}・{住所|じゅうしょ}・{学校|がっこう}を{教|おし}えない||{知|し}らない{人|ひと}に「どこに{住|す}んでるの？」と{聞|き}かれても{答|こた}えない。',
    '{写真|しゃしん}にも{個人情報|こじんじょうほう}が{写|うつ}っている||{制服|せいふく}、{名札|なふだ}、{家|いえ}のまわりの{景色|けしき}などから、{場所|ばしょ}やだれかがわかることがあります。',
    '{友|とも}だちや{家族|かぞく}の{写真|しゃしん}・{情報|じょうほう}をのせるときは、{本人|ほんにん}に{聞|き}く||{人|ひと}の{情報|じょうほう}は、その{人|ひと}のものです。',
    'パスワードに{名前|なまえ}や{誕生日|たんじょうび}を{使|つか}わない',
    'こまったら、すぐに{大人|おとな}に{相談|そうだん}する||{一人|ひとり}で{悩|なや}まなくて{大丈夫|だいじょうぶ}です。',
]))

B('<a class="back" href="./">' + r('← かけいずに{戻|もど}る') + '</a>')
B('<footer>' + r('このページを{読|よ}んでも、あなたのかけいずのデータはどこにも{送|おく}られません。') + ' <a href="./terms.html">利用規約・免責事項</a>　<a href="./privacy.html">プライバシーポリシー</a></footer>')


CSS = '''
  :root {
    --bg: #fbf8f3; --surface: #fff; --text: #2b2724; --muted: #6f6760; --border: #ddd5cc;
    --accent: #e07a2f; --accent-soft: #fdeedf; --blue: #3f7fd8; --blue-soft: #e6f0fd;
    --red: #c0392b; --red-soft: #fdecea; --green: #2e9d5b; --green-soft: #e3f6ea;
    color-scheme: light;
    font-family: 'Hiragino Maru Gothic ProN', 'Zen Maru Gothic', 'BIZ UDPGothic', 'Noto Sans JP', system-ui, sans-serif;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font-size: 17px; line-height: 2.1; }
  main { max-width: 820px; margin: 0 auto; padding: calc(1.5rem + env(safe-area-inset-top, 0px)) 1rem 4rem; }
  h1 { font-size: 1.8rem; margin: 0 0 0.5rem; }
  h2 { font-size: 1.35rem; margin: 3rem 0 0.8rem; padding-bottom: 0.3rem; border-bottom: 3px solid var(--accent); }
  h2 .num { display: inline-grid; place-items: center; width: 1.8em; height: 1.8em; margin-right: 0.4em; border-radius: 50%; background: var(--accent); color: #fff; font-size: 0.85em; line-height: 1; }
  h3 { font-size: 1.1rem; margin: 1.5rem 0 0.4rem; }
  h1, h2, h3 { line-height: 1.9; }
  p { margin: 0.6rem 0; }
  ruby { ruby-position: over; ruby-align: center; }
  rt { font-size: 0.5em; color: var(--muted); font-weight: 400; letter-spacing: 0; }
  .lead { color: var(--muted); }
  .toc { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 0.8rem 1.2rem; }
  .toc ol { margin: 0; padding-left: 1.4em; }
  .toc a { color: var(--text); }
  figure { margin: 1.2rem 0; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 0.8rem; }
  figure svg { width: 100%; height: auto; display: block; }
  figcaption { font-size: 0.85rem; color: var(--muted); text-align: center; margin-top: 0.4rem; }
  .point { background: var(--accent-soft); border-radius: 12px; padding: 0.8rem 1rem; margin: 1rem 0; font-weight: 700; }
  .danger { background: var(--red-soft); border-left: 6px solid var(--red); border-radius: 8px; padding: 0.8rem 1rem; margin: 1rem 0; }
  .danger strong { color: var(--red); }
  .adult { background: var(--surface); border: 1px dashed var(--muted); border-radius: 12px; padding: 0.4rem 1rem 0.8rem; margin: 1.2rem 0; font-size: 0.92rem; line-height: 1.8; }
  .adult summary { cursor: pointer; font-weight: 700; padding: 0.4rem 0; }
  .adult ul { margin: 0.3rem 0; padding-left: 1.2em; }
  .checklist { list-style: none; padding: 0; margin: 1rem 0; display: flex; flex-direction: column; gap: 0.6rem; }
  .checklist li { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 0.7rem 1rem 0.7rem 3rem; position: relative; line-height: 1.9; }
  .checklist li::before { content: '✓'; position: absolute; left: 1rem; top: 0.9rem; width: 1.5rem; height: 1.5rem; border-radius: 50%; background: var(--green); color: #fff; display: grid; place-items: center; font-weight: 900; font-size: 0.9rem; line-height: 1; }
  .checklist small { display: block; color: var(--muted); font-size: 0.85rem; line-height: 1.9; }
  code { font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace; background: #f1eeea; padding: 0.1em 0.35em; border-radius: 4px; font-size: 0.9em; word-break: break-all; }
  .back { display: inline-block; margin-top: 2rem; }
  footer { margin-top: 3rem; color: var(--muted); font-size: 0.85rem; }
  .d-title { font-weight: 800; font-size: 15px; fill: var(--text); }
  .d-text { font-size: 13px; fill: var(--text); }
  .d-small { font-size: 11.5px; fill: var(--muted); }
  .d-red { fill: var(--red); font-weight: 800; }
  .d-green { fill: var(--green); font-weight: 800; }
  .d-blue { fill: var(--blue); font-weight: 800; }
  @media (max-width: 520px) { body { font-size: 16px; } h1 { font-size: 1.5rem; } }
'''

html = f'''<!doctype html>
<html lang="ja">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<link rel="icon" type="image/svg+xml" href="./favicon.svg" />
<title>かけいずの仕組みと個人情報の注意</title>
<!-- Generated by tools/build_guide.py - edit that file, not this one. -->
<style>{CSS}</style>
</head>
<body>
<main>
{chr(10).join(body)}
</main>
</body>
</html>
'''

text_only = re.sub(r'<style>.*?</style>|<svg.*?</svg>', '', html, flags=re.S)
assert '{' not in text_only, 'unconverted {kanji|reading} markup left'
OUT.write_text(html, encoding='utf-8')
print(f'wrote {OUT.relative_to(OUT.parent.parent.parent)}: {html.count("<ruby")} ruby, {html.count("<ruby style")} with overhang')
