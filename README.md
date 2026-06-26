# JLPT 회독 단어장 웹앱

로컬에서 바로 여는 JLPT N5/N4/추가 단어 회독용 웹앱입니다.

## 실행

`index.html`을 브라우저로 열면 됩니다.

GitHub Pages에 배포한 뒤에는 같은 브라우저에서 같은 주소로 접속하는 한 저장 단어가 계속 유지됩니다. 저장 목록은 서버가 아니라 브라우저 `localStorage`에 저장되므로, 브라우저 데이터 삭제나 다른 기기/다른 브라우저 접속 시에는 공유되지 않습니다.

## 데이터

- `data/jlpt_words.csv`: N5/N4/추가 단어 CSV
- `data/jlpt_kanji.csv`: N5~N4 한자 모음 CSV, 총 182개
- `data/jlpt_words_data.js`: 브라우저에서 바로 쓰기 위한 단어 데이터
- `data/jlpt_kanji_data.js`: 브라우저에서 바로 쓰기 위한 한자 데이터
- `data/kanji_radical_data.js`: Unicode Unihan `kRSUnicode`, `kTotalStrokes`와 EDRDG KRADFILE 기반 한자 부수/구성요소 분석 데이터

## 동작

- N5/N4/추가 단어 묶음별로 분리
- 20개 단위로 회독
- 화면 하나에 단어 하나만 표시
- `일본어` 버튼: 발음 표시
- `한국어` 버튼: 한국어 뜻, 한자 설명, 예문 표시
- 뜻을 열면 단어에 포함된 한자를 대표 부수, 획수, 보이는 구성요소, 구성요소별 의미로 분석해 표시
- `공부하겠음` 버튼: 해당 단어를 저장 목록에 추가하고 다음 단어로 이동
- `알고있음` 버튼: 저장 목록에서 제거하고 다음 단어로 이동
- `공부할 단어 회독`: 저장된 단어만 다시 회독

저장 목록은 브라우저 localStorage에 저장됩니다.

## 부수 데이터 재생성

`python3 tools/build_kanji_radical_data.py`

스크립트는 Unicode Unihan 최신 데이터와 EDRDG KRADFILE을 받아 현재 단어장/한자 모음에 등장하는 한자만 추려 `data/kanji_radical_data.js`를 다시 만듭니다. 외부 사이트 본문을 복제하지 않고, 공개 데이터의 부수/구성요소와 앱의 기존 한자 뜻을 결합합니다.

KRADFILE/RADKFILE 저작권은 EDRDG에 있으며 CC BY-SA 4.0 조건으로 제공됩니다.

- KRADFILE/RADKFILE 설명: http://www.edrdg.org/krad/kradinf.html
- EDRDG 라이선스: http://www.edrdg.org/edrdg/licence.html
- Unicode Unihan: https://www.unicode.org/reports/tr38/
