# JLPT 회독 단어장·문법 웹앱

JLPT N5/N4/N3 단어 회독, 급수별 랜덤 테스트, N3 문법 문형 회독을 제공하는 정적 웹앱입니다. 데이터 파일의 `추가` 레벨은 화면에서 N3로 표시합니다.

## 실행

`index.html`을 브라우저로 열거나 정적 웹 서버로 실행합니다.

GitHub Pages에 배포한 뒤에는 같은 브라우저에서 같은 주소로 접속하는 한 저장 단어가 계속 유지됩니다. 저장 목록은 서버가 아니라 브라우저 `localStorage`에 저장되므로, 브라우저 데이터 삭제나 다른 기기/다른 브라우저 접속 시에는 공유되지 않습니다.

## 데이터

- `data/jlpt_words.csv`: N5/N4/추가 단어 CSV (`추가`는 화면에서 N3로 표시)
- N3에는 `JLPT_after_MD_vocab_collection_7_1.md`의 신규 단어를 병합하고 전체 279개를 50개 단위 6장으로 구성
- `data/jlpt_kanji.csv`: N5~N4 한자 모음 CSV, 총 182개
- `data/jlpt_words_data.js`: 브라우저에서 바로 쓰기 위한 단어 데이터
- `data/jlpt_kanji_data.js`: 브라우저에서 바로 쓰기 위한 한자 데이터
- `data/kanji_radical_data.js`: Unicode Unihan `kRSUnicode`, `kTotalStrokes`와 EDRDG KRADFILE 기반 한자 부수/구성요소 분석 데이터
- `data/jlpt_grammar_data.js`: N3 핵심 문형 108개. 접속, 뜻, 쓰는 감각, 유사 문형 구별, 새 예문, 읽기, 해석 포함

## 동작

- 홈(`/`)에서 N5, N4, N3, 문법, 모르는 단어 페이지를 선택
- 급수별 페이지(`/N5/`, `/N4/`, `/N3/`)에서 단계 회독, 단어장, 20문제 랜덤 테스트 제공
- 문법 페이지(`/grammar/`)에서 우선순위별 6장 회독, 문형 목록, 헷갈린 문형, 가중 랜덤 회독 20개 제공
- 문법은 `わけ·はず`, `そう·よう·らしい`, `ところ·ばかり`처럼 보기에서 충돌하는 문형을 먼저 배치
- 문법 카드에는 `접속 → 핵심 뜻 → 쓰는 감각 → 보기 구별 → 예문/읽기/해석`을 표시
- 문법의 `헷갈림` 횟수가 많을수록 랜덤 회독에 나올 확률을 높이고, 진행 중인 장과 완료한 장을 브라우저에 저장
- 모르는 단어 전용 페이지는 `/review/`
- 누적 회독은 최대 150개이며 1~150, 151~279 구간별로 다시 누적
- 회독을 시작한 단계는 `회독중`, 완료한 단계와 같은 150단어 구간의 이전 단계는 `회독 완료`로 표시
- `공부하겠음`을 누른 횟수를 단어별로 저장하고, `1 + min(횟수, 20) × 2` 가중치로 랜덤 테스트 출제 빈도를 높임
- 화면 하나에 단어 하나만 표시
- `일본어` 버튼: 발음 표시
- `한국어` 버튼: 한국어 뜻, 한자 설명, 예문 표시
- 뜻을 열면 단어에 포함된 한자를 대표 부수, 획수, 보이는 구성요소, 구성요소별 의미로 분석해 표시
- `공부하겠음` 버튼: 해당 단어를 저장 목록에 추가하고 다음 단어로 이동
- `알고있음` 버튼: 저장 목록에서 제거하고 다음 단어로 이동
- `모르는 단어 회독`: 저장된 단어만 다시 회독

저장 목록, 단어별 공부 횟수, 회독 완료 단계, 회독중 단계, 진행 중인 회독 큐는 브라우저 localStorage에 저장됩니다.

## 구조

- `index.html`: 홈
- `N5/`, `N4/`, `N3/`: 급수별 페이지
- `grammar/`: N3 문법 문형 회독 페이지
- `review/`: 모르는 단어 페이지
- `scripts/core.js`: 공통 데이터, 저장소, 회독 범위, 가중 추출
- `scripts/study.js`: 공통 카드 학습 UI
- `scripts/grammar.js`: 문법 단계, 카드, 헷갈림 저장, 회독 재개, 가중 랜덤 회독
- `scripts/home.js`, `scripts/level.js`, `scripts/review.js`: 페이지별 동작

## 문법 선정 기준

로컬 `추가md파일/문법`의 N3 PDF 2개를 합친 뒤, 기본 조사나 `～ている`, `～たい`처럼 현재 학습 수준에서 너무 쉬운 항목은 제외했습니다. JLPT 공식 고정 문법 목록은 없으므로 N3의 문법형 선택, 문장 조립, 글 흐름 판단 방식에 맞춰 비슷한 문형의 접속과 쓰임 차이를 우선했습니다. PDF 예문을 그대로 복제하지 않고 각 문형에 맞는 짧은 예문을 새로 작성했습니다.

- JLPT N3 출제 문항 구성: https://samplequestions.jlpt.jp/e/guideline/pdf/n3_e.pdf
- MLC N3 문법 자료: https://www.mlcjapanese.co.jp/n3_04_12.html
- 조건 표현 비교: https://www.japanistry.com/conditionals/
- 日本語NET N3 문법 자료: https://nihongokyoshi-net.com/2018/07/18/jlptn3-grammar-wakedewanai/

## 부수 데이터 재생성

`python3 tools/build_kanji_radical_data.py`

Markdown 단어 표를 N3에 병합할 때는 `python3 tools/import_vocab_markdown.py <파일 경로>`를 실행합니다. 일본어와 읽기가 같은 기존 단어는 설명과 출처만 갱신합니다.

스크립트는 Unicode Unihan 최신 데이터와 EDRDG KRADFILE을 받아 현재 단어장/한자 모음에 등장하는 한자만 추려 `data/kanji_radical_data.js`를 다시 만듭니다. 외부 사이트 본문을 복제하지 않고, 공개 데이터의 부수/구성요소와 앱의 기존 한자 뜻을 결합합니다.

KRADFILE/RADKFILE 저작권은 EDRDG에 있으며 CC BY-SA 4.0 조건으로 제공됩니다.

- KRADFILE/RADKFILE 설명: http://www.edrdg.org/krad/kradinf.html
- EDRDG 라이선스: http://www.edrdg.org/edrdg/licence.html
- Unicode Unihan: https://www.unicode.org/reports/tr38/
