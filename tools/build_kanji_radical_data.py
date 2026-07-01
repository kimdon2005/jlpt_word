#!/usr/bin/env python3
"""Build the browser-side kanji radical data used by the JLPT app."""

from __future__ import annotations

import io
import gzip
import json
import re
import urllib.request
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WORDS_JS = ROOT / "data" / "jlpt_words_data.js"
KANJI_JS = ROOT / "data" / "jlpt_kanji_data.js"
OUTPUT_JS = ROOT / "data" / "kanji_radical_data.js"

UNIHAN_ZIP_URL = "https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip"
CJK_RADICALS_URL = "https://www.unicode.org/Public/UCD/latest/ucd/CJKRadicals.txt"
KRADFILE_URL = "http://ftp.edrdg.org/pub/Nihongo/kradfile-u.gz"

RADICAL_META = {
    "1": {"name": "한 일", "display": "一", "hint": "하나, 선, 기준선", "strokes": 1},
    "2": {"name": "뚫을 곤", "display": "丨", "hint": "세로로 통과하는 선", "strokes": 1},
    "3": {"name": "점 주", "display": "丶", "hint": "작은 점이나 표시", "strokes": 1},
    "6": {"name": "갈고리 궐", "display": "亅", "hint": "갈고리처럼 꺾이는 모양", "strokes": 1},
    "8": {"name": "돼지해머리 두", "display": "亠", "hint": "머리나 위쪽 덮개", "strokes": 2},
    "9": {"name": "사람 인", "display": "人/亻", "hint": "사람, 인물, 사람의 행동", "strokes": 2},
    "10": {"name": "어진사람 인", "display": "儿", "hint": "사람의 다리나 사람 모습", "strokes": 2},
    "11": {"name": "들 입", "display": "入", "hint": "들어감, 받아들임, 안쪽", "strokes": 2},
    "12": {"name": "여덟 팔", "display": "八", "hint": "나뉨, 벌어짐, 여럿", "strokes": 2},
    "13": {"name": "멀 경", "display": "冂", "hint": "테두리, 바깥 경계", "strokes": 2},
    "14": {"name": "덮을 멱", "display": "冖", "hint": "위에서 덮는 덮개", "strokes": 2},
    "15": {"name": "얼음 빙", "display": "冫", "hint": "얼음, 차가움, 굳음", "strokes": 2},
    "17": {"name": "입벌릴 감", "display": "凵", "hint": "그릇, 움푹 열린 공간", "strokes": 2},
    "18": {"name": "칼 도", "display": "刀/刂", "hint": "칼, 자르기, 나누기", "strokes": 2},
    "19": {"name": "힘 력", "display": "力", "hint": "힘, 노력, 작용", "strokes": 2},
    "20": {"name": "쌀 포", "display": "勹", "hint": "감싸 안음, 둘러쌈", "strokes": 2},
    "21": {"name": "비수 비", "display": "匕", "hint": "숟가락이나 굽은 도구", "strokes": 2},
    "23": {"name": "감출 혜", "display": "匸", "hint": "감추거나 둘러싼 공간", "strokes": 2},
    "24": {"name": "열 십", "display": "十", "hint": "열, 완성된 수, 교차", "strokes": 2},
    "26": {"name": "병부 절", "display": "卩", "hint": "무릎 꿇은 사람, 표식", "strokes": 2},
    "27": {"name": "언덕 엄", "display": "厂", "hint": "기슭, 절벽, 덮인 공간", "strokes": 2},
    "28": {"name": "사사 사", "display": "厶", "hint": "사사로움, 개인적인 것, 굽은 팔", "strokes": 2},
    "29": {"name": "또 우", "display": "又", "hint": "손, 다시 잡는 동작", "strokes": 2},
    "30": {"name": "입 구", "display": "口", "hint": "입, 말, 구멍, 네모난 공간", "strokes": 3},
    "31": {"name": "에워쌀 위", "display": "囗", "hint": "둘러싼 경계나 안쪽 공간", "strokes": 3},
    "32": {"name": "흙 토", "display": "土", "hint": "흙, 땅, 장소", "strokes": 3},
    "33": {"name": "선비 사", "display": "士", "hint": "사람, 지위, 선비", "strokes": 3},
    "35": {"name": "천천히 걸을 쇠", "display": "夊", "hint": "천천히 걷거나 내려가는 동작", "strokes": 3},
    "36": {"name": "저녁 석", "display": "夕", "hint": "저녁, 밤, 시간", "strokes": 3},
    "37": {"name": "큰 대", "display": "大", "hint": "큼, 넓음, 사람의 큰 모습", "strokes": 3},
    "38": {"name": "여자 녀", "display": "女", "hint": "여자, 사람 관계, 부드러움", "strokes": 3},
    "39": {"name": "아이 자", "display": "子", "hint": "아이, 자식, 배움", "strokes": 3},
    "40": {"name": "집 면", "display": "宀", "hint": "집, 건물, 안쪽 공간", "strokes": 3},
    "41": {"name": "마디 촌", "display": "寸", "hint": "손의 동작, 치수, 법도", "strokes": 3},
    "42": {"name": "작을 소", "display": "小", "hint": "작음, 작게 나뉜 것", "strokes": 3},
    "43": {"name": "절름발이 왕", "display": "尢", "hint": "굽은 사람, 불완전한 모습", "strokes": 3},
    "44": {"name": "주검 시", "display": "尸", "hint": "몸, 집 안에 누운 모습", "strokes": 3},
    "48": {"name": "장인 공", "display": "工", "hint": "도구, 일, 정교하게 만드는 행위", "strokes": 3},
    "50": {"name": "수건 건", "display": "巾", "hint": "천, 수건, 덮개", "strokes": 3},
    "51": {"name": "방패 간", "display": "干", "hint": "막는 도구, 줄기, 말림", "strokes": 3},
    "53": {"name": "집 엄", "display": "广", "hint": "넓은 집이나 건물", "strokes": 3},
    "54": {"name": "길게 걸을 인", "display": "廴", "hint": "길게 이어지는 걸음", "strokes": 3},
    "57": {"name": "활 궁", "display": "弓", "hint": "활, 휘어진 모양, 당김", "strokes": 3},
    "58": {"name": "돼지머리 계", "display": "彐", "hint": "손이나 빗자루처럼 층이 있는 모양", "strokes": 3},
    "60": {"name": "조금 걸을 척", "display": "彳", "hint": "걷기, 이동, 길", "strokes": 3},
    "61": {"name": "마음 심", "display": "心/忄", "hint": "마음, 감정, 생각", "strokes": 4},
    "62": {"name": "창 과", "display": "戈", "hint": "창, 무기, 싸움", "strokes": 4},
    "63": {"name": "지게 호", "display": "戶", "hint": "문, 집의 출입구", "strokes": 4},
    "64": {"name": "손 수", "display": "手/扌", "hint": "손, 잡기, 움직이는 동작", "strokes": 4},
    "65": {"name": "지탱할 지", "display": "支", "hint": "가지, 받침, 손으로 지탱함", "strokes": 4},
    "66": {"name": "칠 복", "display": "攴", "hint": "치다, 두드리다, 손으로 작용함", "strokes": 4},
    "67": {"name": "글월 문", "display": "文", "hint": "글, 무늬, 기록", "strokes": 4},
    "68": {"name": "말 두", "display": "斗", "hint": "되, 양을 재는 그릇", "strokes": 4},
    "69": {"name": "도끼 근", "display": "斤", "hint": "도끼, 베어 나눔, 무게 단위", "strokes": 4},
    "70": {"name": "모 방", "display": "方", "hint": "방향, 방법, 네모", "strokes": 4},
    "72": {"name": "날 일", "display": "日", "hint": "해, 날, 시간, 밝음", "strokes": 4},
    "73": {"name": "가로 왈", "display": "曰", "hint": "말하다, 말의 내용", "strokes": 4},
    "74": {"name": "달 월", "display": "月", "hint": "달, 시간, 몸의 일부", "strokes": 4},
    "75": {"name": "나무 목", "display": "木", "hint": "나무, 재료, 자람", "strokes": 4},
    "76": {"name": "하품 흠", "display": "欠", "hint": "하품, 부족함, 입을 벌림", "strokes": 4},
    "77": {"name": "그칠 지", "display": "止", "hint": "발, 멈춤, 발자국", "strokes": 4},
    "78": {"name": "죽을 대", "display": "歹", "hint": "죽음, 나쁨, 부서짐", "strokes": 4},
    "79": {"name": "갖은등글월문 수", "display": "殳", "hint": "손에 든 도구, 치는 동작", "strokes": 4},
    "81": {"name": "견줄 비", "display": "比", "hint": "나란히 놓고 견줌, 비교", "strokes": 4},
    "84": {"name": "기운 기", "display": "气", "hint": "기운, 공기, 증기", "strokes": 4},
    "85": {"name": "물 수", "display": "水/氵", "hint": "물, 액체, 흐름", "strokes": 4},
    "86": {"name": "불 화", "display": "火/灬", "hint": "불, 열, 태움", "strokes": 4},
    "93": {"name": "소 우", "display": "牛/牜", "hint": "소, 가축, 힘", "strokes": 4},
    "94": {"name": "개 견", "display": "犬/犭", "hint": "개, 짐승, 날랜 움직임", "strokes": 4},
    "96": {"name": "구슬 옥", "display": "玉/王", "hint": "구슬, 보석, 귀한 것", "strokes": 5},
    "99": {"name": "달 감", "display": "甘", "hint": "달다, 맛", "strokes": 5},
    "100": {"name": "날 생", "display": "生", "hint": "태어남, 삶, 자람", "strokes": 5},
    "101": {"name": "쓸 용", "display": "用", "hint": "씀, 쓰임새", "strokes": 5},
    "102": {"name": "밭 전", "display": "田", "hint": "밭, 구획, 경작지", "strokes": 5},
    "103": {"name": "짝 필", "display": "疋", "hint": "발, 걸음, 짝을 이루는 단위", "strokes": 5},
    "104": {"name": "병들 녁", "display": "疒", "hint": "병, 아픔, 몸 상태", "strokes": 5},
    "105": {"name": "필 발", "display": "癶", "hint": "벌어진 발, 움직임", "strokes": 5},
    "106": {"name": "흰 백", "display": "白", "hint": "흼, 밝음, 분명함", "strokes": 5},
    "109": {"name": "눈 목", "display": "目", "hint": "눈, 보기, 살핌", "strokes": 5},
    "111": {"name": "화살 시", "display": "矢", "hint": "화살, 곧음, 빠름", "strokes": 5},
    "112": {"name": "돌 석", "display": "石", "hint": "돌, 단단함, 광물", "strokes": 5},
    "113": {"name": "보일 시", "display": "示/礻", "hint": "보임, 제사, 신성한 일", "strokes": 5},
    "115": {"name": "벼 화", "display": "禾", "hint": "벼, 곡식, 수확", "strokes": 5},
    "116": {"name": "구멍 혈", "display": "穴", "hint": "구멍, 빈 곳, 집 안 공간", "strokes": 5},
    "117": {"name": "설 립", "display": "立", "hint": "서 있음, 세움", "strokes": 5},
    "118": {"name": "대 죽", "display": "竹/⺮", "hint": "대나무, 죽간, 도구", "strokes": 6},
    "119": {"name": "쌀 미", "display": "米", "hint": "쌀, 곡식, 작은 알갱이", "strokes": 6},
    "120": {"name": "실 사", "display": "糸/糹", "hint": "실, 이어짐, 엮음", "strokes": 6},
    "123": {"name": "양 양", "display": "羊", "hint": "양, 온순함, 제물, 아름다움", "strokes": 6},
    "124": {"name": "깃 우", "display": "羽", "hint": "깃, 날개, 나는 동작", "strokes": 6},
    "125": {"name": "늙을 로", "display": "老", "hint": "늙음, 오래됨, 경험", "strokes": 6},
    "128": {"name": "귀 이", "display": "耳", "hint": "귀, 듣기", "strokes": 6},
    "130": {"name": "고기 육", "display": "肉", "hint": "살, 몸, 신체 부위", "strokes": 6},
    "132": {"name": "스스로 자", "display": "自", "hint": "자기 자신, 코, 출발점", "strokes": 6},
    "134": {"name": "절구 구", "display": "臼", "hint": "절구, 찧는 도구", "strokes": 6},
    "137": {"name": "배 주", "display": "舟", "hint": "배, 물 위의 이동 수단", "strokes": 6},
    "138": {"name": "그칠 간", "display": "艮", "hint": "멈춤, 뒤돌아보는 모양", "strokes": 6},
    "139": {"name": "빛 색", "display": "色", "hint": "색, 빛, 모양", "strokes": 6},
    "140": {"name": "풀 초", "display": "艸/艹", "hint": "풀, 식물, 약재", "strokes": 6},
    "144": {"name": "다닐 행", "display": "行", "hint": "가다, 길, 행위", "strokes": 6},
    "145": {"name": "옷 의", "display": "衣/衤", "hint": "옷, 덮거나 입는 것", "strokes": 6},
    "146": {"name": "덮을 아", "display": "襾/覀", "hint": "덮개, 위에서 씌움", "strokes": 6},
    "147": {"name": "볼 견", "display": "見", "hint": "봄, 관찰, 드러남", "strokes": 7},
    "148": {"name": "뿔 각", "display": "角", "hint": "뿔, 모서리, 뾰족한 부분", "strokes": 7},
    "149": {"name": "말씀 언", "display": "言/訁", "hint": "말, 언어, 기록", "strokes": 7},
    "154": {"name": "조개 패", "display": "貝", "hint": "조개, 돈, 재물", "strokes": 7},
    "156": {"name": "달릴 주", "display": "走", "hint": "달림, 빠른 이동", "strokes": 7},
    "157": {"name": "발 족", "display": "足", "hint": "발, 걷기, 충분함", "strokes": 7},
    "159": {"name": "수레 거", "display": "車", "hint": "수레, 바퀴, 탈것", "strokes": 7},
    "160": {"name": "매울 신", "display": "辛", "hint": "매움, 괴로움, 새김", "strokes": 7},
    "162": {"name": "쉬엄쉬엄 갈 착", "display": "辵/辶", "hint": "길, 이동, 나아감", "strokes": 7},
    "163": {"name": "고을 읍", "display": "邑/阝", "hint": "마을, 도시, 구역", "strokes": 7},
    "164": {"name": "닭 유", "display": "酉", "hint": "술병, 술, 때", "strokes": 7},
    "166": {"name": "마을 리", "display": "里", "hint": "마을, 거리, 안쪽", "strokes": 7},
    "167": {"name": "쇠 금", "display": "金/釒", "hint": "금속, 돈, 단단한 재료", "strokes": 8},
    "169": {"name": "문 문", "display": "門", "hint": "문, 출입구, 사이 공간", "strokes": 8},
    "170": {"name": "언덕 부", "display": "阜/阝", "hint": "언덕, 지형, 쌓인 곳", "strokes": 8},
    "172": {"name": "새 추", "display": "隹", "hint": "새, 작은 새의 모양", "strokes": 8},
    "173": {"name": "비 우", "display": "雨", "hint": "비, 날씨, 하늘 현상", "strokes": 8},
    "174": {"name": "푸를 청", "display": "青", "hint": "푸름, 맑음, 싱싱함", "strokes": 8},
    "176": {"name": "낯 면", "display": "面", "hint": "얼굴, 겉면, 마주 보는 방향", "strokes": 9},
    "181": {"name": "머리 혈", "display": "頁", "hint": "머리, 얼굴, 페이지", "strokes": 9},
    "184": {"name": "먹을 식", "display": "食/飠", "hint": "먹기, 음식, 마심", "strokes": 9},
    "185": {"name": "머리 수", "display": "首", "hint": "머리, 목, 으뜸", "strokes": 9},
    "187": {"name": "말 마", "display": "馬", "hint": "말, 탈것, 움직임", "strokes": 10},
    "189": {"name": "높을 고", "display": "高", "hint": "높음, 큼, 높은 위치", "strokes": 10},
    "203": {"name": "검을 흑", "display": "黑", "hint": "검은색, 어두움, 그을림", "strokes": 12},
}

RADICAL_ALIASES = {
    "2": ["｜"],
    "9": ["亻", "⺅", "𠆢"],
    "18": ["刂"],
    "58": ["彑", "ヨ"],
    "38": ["⺾"],
    "61": ["忄"],
    "64": ["扌"],
    "66": ["攵"],
    "85": ["氵"],
    "86": ["灬"],
    "94": ["犭"],
    "113": ["礻"],
    "125": ["耂", "⺹"],
    "130": ["⺼"],
    "140": ["⺾"],
    "145": ["衤"],
    "162": ["辶"],
    "163": ["⻏"],
    "170": ["⻖"],
    "203": ["黒"],
}

COMPONENT_META = {
    "⺌": {"name": "작을 소 변형", "hint": "작음, 흩어진 점, 작은 움직임"},
    "⺹": {"name": "늙을 로 변형", "hint": "늙음, 오래됨, 경험이 쌓인 모습"},
    "ノ": {"name": "삐침 별", "hint": "비스듬히 내려 긋는 획, 기울어진 방향"},
    "ハ": {"name": "여덟 팔 변형", "hint": "둘로 갈라짐, 벌어짐, 나뉜 모양"},
    "マ": {"name": "마", "hint": "구부러져 걸린 모양, 손잡이나 덮개처럼 보이는 요소"},
    "ヨ": {"name": "요", "hint": "손이나 빗자루처럼 층이 있는 모양"},
    "世": {"name": "세상 세", "hint": "세상, 세대, 이어지는 시간"},
    "乙": {"name": "새 을", "hint": "굽고 꺾인 모양, 둘째나 보조적인 흐름"},
    "九": {"name": "아홉 구", "hint": "아홉, 굽은 팔처럼 꺾인 모양"},
    "二": {"name": "두 이", "hint": "둘, 겹침, 위아래의 구분"},
    "井": {"name": "우물 정", "hint": "우물, 네모난 구획, 질서 있게 나뉜 틀"},
    "亡": {"name": "망할 망", "hint": "없어짐, 잃음, 숨음"},
    "也": {"name": "어조사 야", "hint": "말끝을 맺거나 상태를 나타내는 요소"},
    "元": {"name": "근본 원", "hint": "근본, 시작점, 으뜸"},
    "免": {"name": "면할 면", "hint": "벗어남, 면함, 허락됨"},
    "品": {"name": "물건 품", "hint": "여러 물건, 품질, 등급"},
    "冊": {"name": "책 책", "hint": "묶은 책, 기록, 여러 조각의 묶음"},
    "冫": {"name": "얼음 빙", "hint": "얼음, 차가움, 굳음"},
    "几": {"name": "안석 궤", "hint": "받침, 작은 책상, 기대는 틀"},
    "勹": {"name": "쌀 포", "hint": "감싸 안음, 둘러쌈"},
    "勿": {"name": "말 물", "hint": "금지, 하지 않음, 흩어지는 모양"},
    "匚": {"name": "상자 방", "hint": "상자, 옆으로 열린 틀, 담는 공간"},
    "卜": {"name": "점 복", "hint": "점침, 갈라진 금, 판단"},
    "厶": {"name": "사사 사", "hint": "사사로움, 개인적인 것, 구부러진 팔"},
    "及": {"name": "미칠 급", "hint": "따라잡음, 손이 미침, 닿음"},
    "夂": {"name": "뒤져 올 치", "hint": "뒤따라 걷는 발, 늦게 오는 움직임"},
    "小": {"name": "작을 소", "hint": "작음, 작게 나뉜 것"},
    "尤": {"name": "더욱 우", "hint": "특별함, 두드러짐, 굽은 사람 모양"},
    "山": {"name": "뫼 산", "hint": "산, 높이 솟은 모양, 지형"},
    "巛": {"name": "개미허리 천", "hint": "굽이쳐 흐르는 물길이나 이어진 선"},
    "川": {"name": "내 천", "hint": "내, 강, 흐름"},
    "工": {"name": "장인 공", "hint": "도구, 일, 정교하게 만드는 행위"},
    "已": {"name": "이미 이", "hint": "이미 끝남, 멈춤, 굽은 모양"},
    "巴": {"name": "꼬리 파", "hint": "둥글게 말린 모양, 감긴 형태"},
    "并": {"name": "나란할 병", "hint": "나란함, 함께 놓임, 두 갈래"},
    "幺": {"name": "작을 요", "hint": "작음, 가는 실, 미세한 것"},
    "廾": {"name": "받들 공", "hint": "두 손으로 받듦, 들어 올림"},
    "弋": {"name": "주살 익", "hint": "말뚝, 주살, 표시를 꽂는 도구"},
    "彡": {"name": "터럭 삼", "hint": "털, 무늬, 빛이나 모양이 퍼짐"},
    "戸": {"name": "지게 호", "hint": "문, 출입구, 집의 한쪽 문짝"},
    "攵": {"name": "칠 복", "hint": "치다, 두드리다, 손으로 작용함"},
    "斉": {"name": "가지런할 제", "hint": "가지런함, 함께 맞춤, 고르게 함"},
    "斤": {"name": "도끼 근", "hint": "도끼, 베어 나눔, 무게 단위"},
    "毛": {"name": "터럭 모", "hint": "털, 가는 실 같은 것"},
    "毋": {"name": "말 무", "hint": "금지, 하지 않음, 막는 모양"},
    "母": {"name": "어미 모", "hint": "어머니, 낳고 기름, 근원"},
    "氏": {"name": "성씨 씨", "hint": "씨족, 이름, 뿌리"},
    "爪": {"name": "손톱 조", "hint": "손톱, 움켜쥠, 잡는 손"},
    "父": {"name": "아버지 부", "hint": "아버지, 어른, 손에 든 도구"},
    "爿": {"name": "나뭇조각 장", "hint": "나뭇조각, 침상 한쪽, 길게 쪼갠 모양"},
    "玄": {"name": "검을 현", "hint": "검고 깊음, 오묘함, 가는 실"},
    "疋": {"name": "발 소", "hint": "발, 걸음, 짝을 이루는 단위"},
    "皮": {"name": "가죽 피", "hint": "가죽, 껍질, 겉면"},
    "皿": {"name": "그릇 명", "hint": "그릇, 담는 용기"},
    "矛": {"name": "창 모", "hint": "창, 찌르는 도구"},
    "禸": {"name": "짐승발자국 유", "hint": "짐승의 발자국, 남은 흔적"},
    "米": {"name": "쌀 미", "hint": "쌀, 곡식, 작은 알갱이"},
    "罒": {"name": "그물 망", "hint": "그물, 덮어 씌움, 잡아 가둠"},
    "羊": {"name": "양 양", "hint": "양, 온순함, 제물, 아름다움"},
    "耒": {"name": "쟁기 뢰", "hint": "쟁기, 농사 도구, 갈아엎음"},
    "聿": {"name": "붓 율", "hint": "붓을 잡은 손, 쓰기, 기록"},
    "至": {"name": "이를 지", "hint": "도달함, 끝까지 이름"},
    "身": {"name": "몸 신", "hint": "몸, 자기 자신, 신체"},
    "舌": {"name": "혀 설", "hint": "혀, 말, 맛봄"},
    "艮": {"name": "그칠 간", "hint": "멈춤, 등짐, 뒤돌아보는 모양"},
    "虫": {"name": "벌레 훼", "hint": "벌레, 작은 생물, 꿈틀거림"},
    "西": {"name": "서녘 서", "hint": "서쪽, 덮개가 있는 바구니 모양"},
    "豆": {"name": "콩 두", "hint": "콩, 제기, 높임 그릇"},
    "豕": {"name": "돼지 시", "hint": "돼지, 짐승, 몸통이 큰 모양"},
    "釆": {"name": "분별할 변", "hint": "분별함, 흩어진 씨앗이나 발자국"},
    "隶": {"name": "미칠 이", "hint": "붙잡음, 뒤따름, 이어지는 손의 움직임"},
    "長": {"name": "길 장", "hint": "길다, 오래됨, 윗사람"},
    "韋": {"name": "가죽 위", "hint": "가죽, 둘러싼 움직임, 어긋남"},
    "音": {"name": "소리 음", "hint": "소리, 말소리, 울림"},
    "滴": {"name": "물방울 적", "hint": "물방울, 액체가 한 방울씩 떨어짐"},
    "麻": {"name": "삼 마", "hint": "삼, 섬유, 얽힌 줄기"},
    "黄": {"name": "누를 황", "hint": "노란색, 익은 곡식의 빛"},
}

KANJI_MEANING_FALLBACK = {
    "一": "한 일",
    "効": "효과 효",
    "般": "돌 반",
    "者": "놈 자",
}


def load_json_assignment(path: Path, name: str) -> list[dict]:
    text = path.read_text(encoding="utf-8")
    match = re.search(rf"window\.{name}\s*=\s*(\[.*?\]);\s*$", text, re.S)
    if not match:
        raise ValueError(f"Could not find window.{name} assignment in {path}")
    return json.loads(match.group(1))


def fetch_text(url: str) -> str:
    with urllib.request.urlopen(url, timeout=30) as response:
        return response.read().decode("utf-8")


def fetch_binary(url: str) -> bytes:
    with urllib.request.urlopen(url, timeout=60) as response:
        return response.read()


def fetch_unihan_file(filename: str) -> str:
    with urllib.request.urlopen(UNIHAN_ZIP_URL, timeout=60) as response:
        archive = response.read()
    with zipfile.ZipFile(io.BytesIO(archive)) as zf:
        return zf.read(filename).decode("utf-8")


def fetch_kradfile() -> str:
    return gzip.decompress(fetch_binary(KRADFILE_URL)).decode("utf-8")


def parse_cjk_radicals(text: str) -> dict[str, str]:
    radicals: dict[str, str] = {}
    for line in text.splitlines():
        if not line or line.startswith("#"):
            continue
        number, _radical_code, ideograph_code = [part.strip() for part in line.split(";")]
        radicals[number.rstrip("'")] = chr(int(ideograph_code, 16))
    return radicals


def parse_unihan_irg(text: str) -> tuple[dict[str, tuple[str, int]], dict[str, int]]:
    rs_unicode: dict[str, tuple[str, int]] = {}
    total_strokes: dict[str, int] = {}
    for line in text.splitlines():
        if not line or line.startswith("#"):
            continue
        code, prop, value = line.split("\t")
        char = chr(int(code[2:], 16))
        if prop == "kRSUnicode":
            first_value = value.split()[0]
            match = re.match(r"^(\d+)'*\.(\-?\d+)", first_value)
            if match:
                rs_unicode[char] = (match.group(1), int(match.group(2)))
        elif prop == "kTotalStrokes":
            match = re.search(r"\d+", value)
            if match:
                total_strokes[char] = int(match.group(0))
    return rs_unicode, total_strokes


def parse_kradfile(text: str) -> dict[str, list[str]]:
    decompositions: dict[str, list[str]] = {}
    for line in text.splitlines():
        if not line or line.startswith("#") or " : " not in line:
            continue
        char, components = line.split(" : ", 1)
        decompositions[char] = components.split()
    return decompositions


def extract_kanji(text: str) -> list[str]:
    return re.findall(r"[\u3400-\u9fff]", text)


def clean_meaning(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def meaning_sense(text: str) -> str:
    return re.sub(r"\s+[가-힣]$", "", clean_meaning(text))


def collect_meanings(words: list[dict], kanji_rows: list[dict]) -> dict[str, str]:
    meanings: dict[str, str] = {}
    for row in kanji_rows:
        meanings[row["kanji"]] = clean_meaning(row["meaning_ko"])

    for word in words:
        note = word.get("kanji_note") or ""
        for chunk in re.split(r"[,;]|\s+\+\s+", note):
            match = re.match(r"^\s*([\u3400-\u9fff])=(.+?)\s*$", chunk)
            if not match:
                continue
            char, meaning = match.groups()
            meanings.setdefault(char, clean_meaning(meaning))

        for part in note.split(" / "):
            part = part.strip()
            if not part or "=" in part:
                continue
            chars = extract_kanji(part[:1])
            if not chars:
                continue
            char = chars[0]
            meaning = clean_meaning(part[1:])
            if meaning:
                meanings.setdefault(char, meaning)

    for char, meaning in KANJI_MEANING_FALLBACK.items():
        meanings.setdefault(char, meaning)
    return meanings


def build_component_meta(meanings: dict[str, str]) -> dict[str, dict[str, str]]:
    meta: dict[str, dict[str, str]] = {}
    for number, item in RADICAL_META.items():
        for component in item["display"].split("/"):
            meta[component] = {
                "name": item["name"],
                "hint": item["hint"],
                "source": "radical",
                "radicalNumber": int(number),
            }
        for component in RADICAL_ALIASES.get(number, []):
            meta[component] = {
                "name": item["name"],
                "hint": item["hint"],
                "source": "radical",
                "radicalNumber": int(number),
            }

    for component, item in COMPONENT_META.items():
        meta[component] = {**item, "source": "component"}

    for component, meaning in meanings.items():
        meta.setdefault(
            component,
            {
                "name": meaning,
                "hint": meaning_sense(meaning),
                "source": "kanji",
            },
        )
    return meta


def component_matches_radical(component: str, radical_number: str, entry: dict) -> bool:
    radical_forms = set(entry["radical"].split("/"))
    radical_forms.add(entry["radicalBase"])
    radical_forms.update(RADICAL_ALIASES.get(radical_number, []))
    return component in radical_forms


def build_data() -> dict[str, dict]:
    words = load_json_assignment(WORDS_JS, "JLPT_WORDS")
    kanji_rows = load_json_assignment(KANJI_JS, "JLPT_KANJI")
    meanings = collect_meanings(words, kanji_rows)

    chars = set(row["kanji"] for row in kanji_rows)
    for word in words:
        chars.update(extract_kanji(word["japanese"]))
        chars.update(extract_kanji(word.get("kanji_note") or ""))

    radical_chars = parse_cjk_radicals(fetch_text(CJK_RADICALS_URL))
    rs_unicode, total_strokes = parse_unihan_irg(fetch_unihan_file("Unihan_IRGSources.txt"))
    decompositions = parse_kradfile(fetch_kradfile())
    component_meta = build_component_meta(meanings)

    data: dict[str, dict] = {}
    missing_meta: set[str] = set()
    missing_decomposition: set[str] = set()
    missing_component_meta: set[str] = set()
    for char in sorted(chars):
        if char not in rs_unicode:
            continue
        radical_number, additional_strokes = rs_unicode[char]
        meta = RADICAL_META.get(radical_number)
        if not meta:
            missing_meta.add(radical_number)
            continue
        radical_char = meta["display"].split("/")[0]
        total_stroke_count = total_strokes.get(char)
        decomposition = decompositions.get(char)
        if not decomposition:
            missing_decomposition.add(char)
            decomposition = []

        components = []
        for component in decomposition:
            component_info = component_meta.get(component)
            if not component_info:
                missing_component_meta.add(component)
                continue
            components.append(
                {
                    "component": component,
                    "name": component_info["name"],
                    "hint": component_info["hint"],
                    "role": "대표 부수" if component_matches_radical(component, radical_number, {
                        "radical": meta["display"],
                        "radicalBase": radical_char or radical_chars.get(radical_number, ""),
                    }) else "구성요소",
                }
            )

        data[char] = {
            "kanji": char,
            "meaning": meanings.get(char, ""),
            "radicalNumber": int(radical_number),
            "radical": meta["display"],
            "radicalBase": radical_char or radical_chars.get(radical_number, ""),
            "radicalName": meta["name"],
            "radicalHint": meta["hint"],
            "radicalStrokes": meta["strokes"],
            "additionalStrokes": additional_strokes,
            "totalStrokes": total_stroke_count,
            "components": components,
        }

    if missing_meta:
        raise ValueError(f"RADICAL_META is missing radical numbers: {sorted(missing_meta)}")
    if missing_decomposition:
        raise ValueError(f"KRADFILE is missing decompositions: {sorted(missing_decomposition)}")
    if missing_component_meta:
        raise ValueError(f"COMPONENT_META is missing components: {sorted(missing_component_meta)}")
    return data


def main() -> None:
    data = build_data()
    OUTPUT_JS.write_text(
        "window.JLPT_KANJI_RADICALS = "
        + json.dumps(data, ensure_ascii=False, indent=2)
        + ";\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(data)} kanji radical entries to {OUTPUT_JS}")


if __name__ == "__main__":
    main()
