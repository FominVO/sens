#!/usr/bin/env python3
"""Build the Ukrainian lexicon and per-puzzle similarity ranks for Сенс.

Inputs (not redistributed):
  * UberText 2.0 lemma frequencies (lang-uk)
  * fastText cc.uk.300.vec.gz (Facebook, CC BY-SA 3.0), streamed and reduced
    to the game vocabulary
  * pymorphy3 with Ukrainian dictionaries, used only to lemmatize and filter

Outputs in public/data/:
  * vocab.json          display lemmas
  * forms.bin           folded surface form -> vocab index
  * manifest.json       epoch, sizes, bands
  * ranks/{id}.bin      uint16 rank of every vocab word for puzzle id
  * pipeline/secrets_order.txt   stable puzzle order

Rank 1 is the secret word. Lower rank means closer in cosine similarity.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import json
import struct
import sys
import time
import urllib.request
from collections import OrderedDict, defaultdict
from datetime import date
from pathlib import Path

import numpy as np
import pymorphy3

ROOT = Path(__file__).resolve().parents[1]
PIPELINE = Path(__file__).resolve().parent
FASTTEXT_URL = "https://dl.fbaipublicfiles.com/fasttext/vectors-crawl/cc.uk.300.vec.gz"
EPOCH = date(2025, 9, 1)
PROPER = frozenset({"Name", "Surn", "Patr", "Geox", "Orgn", "Trad"})
SKIP_GRAMS = frozenset({"Abbr", "Slng", "Erro", "Init"})
VOWELS = set("аеєиіїоуюя")
RUSSIAN_LETTERS = set("ыэъё")
APOSTROPHES = "'’ʼ`´ʹ′'"

# Префікси лайки. Короткі, щоб не зачепити звичайні слова на кшталт «мудрість» чи «пісня».
BAD_PREFIXES = (
    "хуй",
    "хуї",
    "хує",
    "хуйо",
    "хуя",
    "пізд",
    "пизд",
    "їбан",
    "єбан",
    "їбат",
    "єбат",
    "їбуч",
    "єбуч",
    "бляд",
    "мудак",
    "мудил",
    "мудох",
    "гівн",
    "говн",
)

# Не брати ці леми як секрет, якщо доводиться добирати зі словника.
BACKFILL_SKIP = {
    "президент",
    "міністр",
    "депутат",
    "область",
    "район",
    "гривня",
    "долар",
    "відсоток",
    "засідання",
    "комісія",
    "комітет",
    "уряд",
    "партія",
    "вибори",
    "населення",
    "інформація",
    "результат",
    "рішення",
    "питання",
    "система",
    "організація",
    "представник",
    "ситуація",
    "кількість",
    "рівень",
    "частина",
    "особа",
    "рада",
    "компанія",
    "влада",
    "держава",
    "територія",
    "участь",
    "дані",
    "група",
    "проект",
    "проєкт",
    "посилання",
    "тисяча",
    "мільйон",
    "мільярд",
    "номер",
    "спосіб",
    "умова",
    "процес",
    "структура",
    "функція",
    "модель",
    "вартість",
    "відсоток",
    "заява",
    "повідомлення",
    "документ",
    "матеріал",
    "обсяг",
    "показник",
    "фактор",
    "елемент",
    "об'єкт",
    "суб'єкт",
    "пункт",
    "стаття",
    "норма",
    "порядок",
    "захід",
    "заходи",
    "член",
    "служба",
    "орган",
    "відомство",
    "установа",
    "підприємство",
    "товариство",
    "акція",
    "бюджет",
    "податок",
    "збір",
    "кошти",
    "рахунок",
    "договір",
    "угода",
    "протокол",
    "рішення",
    "постанова",
    "розпорядження",
    "наказ",
    "закон",
    "кодекс",
    "конституція",
    "вимога",
    "пропозиція",
    "ініціатива",
    "програма",
    "стратегія",
    "концепція",
    "реформа",
    "криза",
    "конфлікт",
    "санкція",
    "переговори",
    "делегація",
    "самміт",
    "форум",
    "конференція",
    "брифінг",
    "інтерв'ю",
    "коментар",
    "заява",
    "джерело",
    "факт",
    "подія",
    "випадок",
    "проблема",
    "завдання",
    "мета",
    "ціль",
    "план",
    "етап",
    "крок",
    "шлях",
    "напрям",
    "напрямок",
    "сфера",
    "галузь",
    "сектор",
    "ринок",
    "банк",
    "фонд",
    "кредит",
    "борг",
    "інвестиція",
    "прибуток",
    "збиток",
    "дохід",
    "витрата",
    "собівартість",
    "інфляція",
    "курс",
    "ставка",
    "індекс",
    "рейтинг",
    "опитування",
    "дослідження",
    "аналіз",
    "звіт",
    "статистика",
    "дані",
    "база",
    "мережа",
    "сайт",
    "сторінка",
    "користувач",
    "акаунт",
    "пароль",
    "файл",
    "формат",
    "версія",
    "оновлення",
    "помилка",
    "збій",
    "ризик",
    "загроза",
    "безпека",
    "захист",
    "контроль",
    "нагляд",
    "перевірка",
    "аудит",
    "суд",
    "позов",
    "справа",
    "обвинувачення",
    "вирок",
    "покарання",
    "штраф",
    "арешт",
    "слідство",
    "поліція",
    "прокуратура",
    "адвокат",
    "свідок",
    "потерпілий",
    "злочин",
    "крадіжка",
    "вбивство",
    "напад",
    "зброя",
    "війна",
    "мир",
    "армія",
    "фронт",
    "удар",
    "обстріл",
    "ракет",
    "дрон",
    "окупація",
    "звільнення",
    "оборона",
    "наступ",
    "бригада",
    "батальйон",
    "полк",
    "генерал",
    "офіцер",
    "солдат",
    "полон",
    "евакуація",
    "гуманітарний",
    "допомога",
    "волонтер",
    "біженець",
    "переселенець",
    "особа",
    "громадянин",
    "мешканець",
    "населення",
    "громада",
    "суспільство",
    "держава",
    "країна",
    "область",
    "район",
    "громада",
    "влада",
    "президент",
    "уряд",
    "парламент",
    "рада",
    "депутат",
    "міністр",
    "чиновник",
    "посадовець",
    "керівник",
    "голова",
    "заступник",
    "представник",
    "делегат",
    "учасник",
    "організатор",
    "партнер",
    "сторона",
    "позиція",
    "думка",
    "заява",
    "слово",
    "мова",
    "текст",
    "назва",
    "ім'я",
    "прізвище",
    "побатькові",
    "дата",
    "час",
    "рік",
    "день",
    "раз",
    "місце",
    "частина",
    "вид",
    "тип",
    "форма",
    "розмір",
    "рівень",
    "стан",
    "склад",
    "структура",
    "система",
    "порядок",
    "правило",
    "умова",
    "причина",
    "наслідок",
    "результат",
    "ефект",
    "вплив",
    "роль",
    "значення",
    "зміст",
    "суть",
    "основа",
    "початок",
    "кінець",
    "центр",
    "край",
    "межа",
    "відстань",
    "швидкість",
    "темп",
    "обсяг",
    "кількість",
    "якість",
    "вартість",
    "ціна",
    "сума",
    "частка",
    "відсоток",
    "номер",
    "код",
    "знак",
    "символ",
    "одиниця",
    "показник",
}

SANITY = [
    ("кіт", ["кішка", "пес", "кошеня", "собака", "цуценя"]),
    ("море", ["океан", "хвиля", "берег", "річка", "озеро"]),
    ("яблуко", ["груша", "слива", "фрукт", "сад"]),
    ("лікар", ["лікарня", "пацієнт", "медицина", "хвороба"]),
    ("школа", ["учитель", "учень", "урок", "вчитель"]),
    ("хліб", ["булка", "тісто", "борошно", "пекар"]),
    ("автомобіль", ["машина", "колесо", "водій", "дорога"]),
    ("ніч", ["вечір", "ранок", "сон", "темрява", "день"]),
]


def fold_key(value: str) -> str:
    text = value.strip().lower().replace("ґ", "г")
    for ch in APOSTROPHES:
        text = text.replace(ch, "")
    return text


def prettify(value: str) -> str:
    return value.replace("'", "\u2019")


def has_vowel(value: str) -> bool:
    return any(ch in VOWELS for ch in value)


def load_word_set(path: Path) -> set[str]:
    words: set[str] = set()
    if not path.exists():
        return words
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        words.add(fold_key(line.split()[0]))
    return words


def is_blocked(key: str, block: set[str]) -> bool:
    if key in block:
        return True
    return any(key.startswith(prefix) for prefix in BAD_PREFIXES)


def load_curated(path: Path) -> list[tuple[str, str]]:
    rows: list[tuple[str, str]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        raw = line.strip()
        if not raw or raw.startswith("#"):
            continue
        if "\t" in raw:
            cat, word = raw.split("\t", 1)
        else:
            cat, word = "extra", raw
        word = word.strip()
        cat = cat.strip() or "extra"
        if word:
            rows.append((cat, word))
    return rows


def ascii_apos(value: str) -> str:
    for ch in "’ʼ`´ʹ′":
        value = value.replace(ch, "'")
    return value


def surface_ok(lemma: str) -> bool:
    if not lemma or " " in lemma or "-" in lemma:
        return False
    if any(ch in RUSSIAN_LETTERS for ch in lemma):
        return False
    if any(ch.isdigit() or ("a" <= ch.lower() <= "z") for ch in lemma):
        return False
    if lemma[0] in APOSTROPHES or lemma[-1] in APOSTROPHES:
        return False
    allowed = set("абвгґдеєжзиіїйклмнопрстуфхцчшщьюя'")
    if any(ch not in allowed for ch in lemma):
        return False
    if lemma.count("'") > 2:
        return False
    folded = fold_key(lemma)
    return 3 <= len(folded) <= 18 and has_vowel(folded)


def choose_parse(morph: pymorphy3.MorphAnalyzer, lemma: str):
    """Citation-form noun only. Inflected lookalikes of other lemmas are rejected."""
    target = fold_key(lemma)
    best = None
    for parse in morph.parse(lemma):
        if not parse.is_known or "NOUN" not in parse.tag:
            continue
        grams = parse.tag.grammemes
        if grams & PROPER or grams & SKIP_GRAMS:
            continue
        if fold_key(parse.normal_form) != target:
            continue
        if best is None:
            best = parse
            continue
        if "nomn" in parse.tag and "nomn" not in best.tag:
            best = parse
    return best


def load_frequencies(path: Path, curated_keys: set[str], min_count: int):
    nouns: dict[str, int] = defaultdict(int)
    propn: dict[str, int] = defaultdict(int)
    spellings: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    with path.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            count = int(row["count"])
            lemma = ascii_apos(row["lemma"].strip().lower())
            if not surface_ok(lemma):
                continue
            key = fold_key(lemma)
            pos = row["pos"]
            keep = count >= min_count or key in curated_keys
            if not keep:
                continue
            if pos == "NOUN":
                nouns[key] += count
                spellings[key][lemma] += count
            elif pos == "PROPN" and (count >= min_count or key in curated_keys):
                propn[key] += count
    return nouns, propn, spellings


def build_pool(morph, nouns, propn, spellings, block: set[str], stoplist: set[str], curated_keys: set[str]):
    pool = []
    blocked_hits = []
    for key, count in nouns.items():
        if key in stoplist or is_blocked(key, block):
            if count >= 5000:
                blocked_hits.append((count, key))
            continue
        proper_count = propn.get(key, 0)
        if proper_count > max(count * 2, 2000) and key not in curated_keys:
            continue
        parse = None
        for spelling, _spelling_count in sorted(spellings[key].items(), key=lambda item: -item[1]):
            parse = choose_parse(morph, spelling)
            if parse is not None:
                break
        if parse is None:
            continue
        normal = parse.normal_form
        if fold_key(normal) != key:
            continue
        if is_blocked(fold_key(normal), block):
            continue
        forms = {normal, *spellings[key].keys()}
        bad_form = False
        for item in parse.lexeme:
            forms.add(item.word)
            if is_blocked(fold_key(item.word), block):
                bad_form = True
                break
        if bad_form:
            if count >= 5000:
                blocked_hits.append((count, normal))
            continue
        pool.append(
            {
                "key": key,
                "display": prettify(normal),
                "count": count,
                "forms": forms,
            }
        )
    pool.sort(key=lambda item: item["count"], reverse=True)
    blocked_hits.sort(reverse=True)
    return pool, blocked_hits[:40]


def scan_fasttext(pool: list[dict], cache_dir: Path, refresh: bool) -> dict[str, np.ndarray]:
    cache_dir.mkdir(parents=True, exist_ok=True)
    words_path = cache_dir / "words.txt"
    vec_path = cache_dir / "vectors.npy"
    meta_path = cache_dir / "meta.json"
    cached: dict[str, np.ndarray] = {}
    if words_path.exists() and vec_path.exists() and not refresh:
        keys = words_path.read_text(encoding="utf-8").splitlines()
        matrix = np.load(vec_path)
        if len(keys) == len(matrix):
            cached = {key: matrix[i] for i, key in enumerate(keys)}
        meta = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else {}
        missing = [item["key"] for item in pool if item["key"] not in cached]
        if meta.get("complete") and not missing:
            print(f"using cached vectors for {len(cached)} lemmas", flush=True)
            return cached
        print(f"cache has {len(cached)} vectors, missing {len(missing)}; streaming fastText", flush=True)
    else:
        print("streaming fastText cc.uk.300.vec.gz", flush=True)

    form_to_ids: dict[str, list[int]] = defaultdict(list)
    for index, item in enumerate(pool):
        keys = {item["key"]}
        for form in item["forms"]:
            folded = fold_key(form)
            if len(folded) >= 2:
                keys.add(folded)
        for key in keys:
            form_to_ids[key].append(index)

    exact: list[np.ndarray | None] = [None] * len(pool)
    sums = np.zeros((len(pool), 300), dtype=np.float32)
    counts = np.zeros(len(pool), dtype=np.int32)
    started = time.time()
    lines = 0
    request = urllib.request.Request(FASTTEXT_URL, headers={"User-Agent": "SensBuild/1.0"})
    with urllib.request.urlopen(request, timeout=120) as response:
        with gzip.GzipFile(fileobj=response) as handle:
            handle.readline()  # "N 300"
            for raw in handle:
                lines += 1
                space = raw.find(b" ")
                if space <= 0 or raw[0] not in (0xD0, 0xD1):
                    if lines % 200000 == 0:
                        _log_scan(lines, exact, counts, started)
                    continue
                try:
                    word = raw[:space].decode("utf-8").lower()
                except UnicodeDecodeError:
                    continue
                if word[0] in RUSSIAN_LETTERS:
                    continue
                if "ґ" in word:
                    word = word.replace("ґ", "г")
                if any(ch in word for ch in APOSTROPHES):
                    for ch in APOSTROPHES:
                        word = word.replace(ch, "")
                ids = form_to_ids.get(word)
                if not ids:
                    if lines % 200000 == 0:
                        _log_scan(lines, exact, counts, started)
                    continue
                rest = raw[space + 1 :].decode("ascii", "ignore")
                vec = np.fromstring(rest, dtype=np.float32, sep=" ", count=300)
                if vec.shape[0] != 300 or not np.isfinite(vec).all():
                    continue
                for index in ids:
                    if word == pool[index]["key"]:
                        if exact[index] is None:
                            exact[index] = vec
                    elif counts[index] < 40:
                        sums[index] += vec
                        counts[index] += 1
                if lines % 200000 == 0:
                    _log_scan(lines, exact, counts, started)
                    if all(vec is not None for vec in exact):
                        print("all lemmas have an exact vector; stopping early", flush=True)
                        break

    found: dict[str, np.ndarray] = {}
    exact_n = 0
    avg_n = 0
    for index, item in enumerate(pool):
        if exact[index] is not None:
            found[item["key"]] = np.asarray(exact[index], dtype=np.float32)
            exact_n += 1
        elif counts[index] > 0:
            found[item["key"]] = sums[index] / counts[index]
            avg_n += 1
    print(
        f"scan done: lines={lines:,} exact={exact_n} averaged={avg_n} "
        f"missing={len(pool) - len(found)} in {time.time() - started:.0f}s",
        flush=True,
    )
    # Merge with any previous cache entries so a partial retarget does not drop words.
    found = {**cached, **found}
    keys = list(found)
    matrix = np.stack([found[key] for key in keys]).astype(np.float32)
    np.save(vec_path, matrix)
    words_path.write_text("\n".join(keys) + "\n", encoding="utf-8")
    meta_path.write_text(
        json.dumps({"complete": True, "source": FASTTEXT_URL, "lines": lines}, ensure_ascii=False),
        encoding="utf-8",
    )
    return found


def _log_scan(lines: int, exact, counts, started: float) -> None:
    have = sum(1 for item in exact if item is not None) + int(np.count_nonzero(counts))
    print(f"  {lines:,} lines, lemmas with vectors ≈ {have}, {time.time() - started:.0f}s", flush=True)


def select_vocab(pool: list[dict], vectors: dict[str, np.ndarray], curated_keys: set[str], vocab_size: int):
    usable = [item for item in pool if item["key"] in vectors]
    usable.sort(key=lambda item: item["count"], reverse=True)
    chosen = usable[:vocab_size]
    chosen_keys = {item["key"] for item in chosen}
    for item in usable:
        if item["key"] in curated_keys and item["key"] not in chosen_keys:
            chosen.append(item)
            chosen_keys.add(item["key"])
    # Stable frequency order, with forced secrets kept even if they sit past the cut.
    chosen.sort(key=lambda item: item["count"], reverse=True)
    return chosen


def build_forms(vocab: list[dict]) -> list[tuple[str, int]]:
    forms: dict[str, int] = {}
    for index, item in enumerate(vocab):
        keys = {item["key"]}
        for form in item["forms"]:
            folded = fold_key(form)
            if 2 <= len(folded) <= 24 and has_vowel(folded):
                keys.add(folded)
        for key in keys:
            forms.setdefault(key, index)
    pairs = sorted(forms.items(), key=lambda pair: pair[0])
    return pairs


def write_forms(path: Path, pairs: list[tuple[str, int]]) -> None:
    with path.open("wb") as handle:
        handle.write(b"FRM1")
        handle.write(struct.pack("<I", len(pairs)))
        for key, index in pairs:
            blob = key.encode("utf-8")
            if len(blob) > 255 or index > 65535:
                raise SystemExit(f"form does not fit the binary layout: {key}")
            handle.write(struct.pack("<HB", index, len(blob)))
            handle.write(blob)


def resolve_order(vocab: list[dict], curated: list[tuple[str, str]], order_path: Path, target: int, rebuild: bool):
    by_key = {item["key"]: item["display"] for item in vocab}
    missing = []
    if order_path.exists() and not rebuild:
        order = []
        seen = set()
        for line in order_path.read_text(encoding="utf-8").splitlines():
            word = line.strip()
            if not word or word.startswith("#"):
                continue
            key = fold_key(word)
            display = by_key.get(key)
            if display is None:
                missing.append(word)
                continue
            if key in seen:
                continue
            seen.add(key)
            order.append(display)
        print(f"reused {len(order)} secrets from {order_path.name}", flush=True)
    else:
        groups: OrderedDict[str, list[str]] = OrderedDict()
        seen = set()
        for cat, word in curated:
            key = fold_key(word)
            if key in seen:
                continue
            display = by_key.get(key)
            if display is None:
                missing.append(word)
                continue
            seen.add(key)
            groups.setdefault(cat, []).append(display)
        order = []
        while any(groups.values()):
            for cat in groups:
                if groups[cat]:
                    order.append(groups[cat].pop(0))
        print(f"interleaved {len(order)} curated secrets across {len(groups)} categories", flush=True)

    seen = {fold_key(word) for word in order}
    if len(order) < target:
        for item in vocab:
            if len(order) >= target:
                break
            if item["key"] in seen or item["key"] in BACKFILL_SKIP:
                continue
            if not 4 <= len(item["key"]) <= 12:
                continue
            order.append(item["display"])
            seen.add(item["key"])
        print(f"order length after backfill: {len(order)}", flush=True)
    if len(order) < 365:
        raise SystemExit(f"only {len(order)} secret words; need at least 365")
    order_path.write_text("\n".join(order) + "\n", encoding="utf-8")
    return order, missing


def write_ranks(out_dir: Path, vocab: list[dict], vectors: dict[str, np.ndarray], order: list[str]) -> None:
    ranks_dir = out_dir / "ranks"
    if ranks_dir.exists():
        for child in ranks_dir.glob("*.bin"):
            child.unlink()
    ranks_dir.mkdir(parents=True, exist_ok=True)
    by_display = {item["display"]: index for index, item in enumerate(vocab)}
    matrix = np.stack([vectors[item["key"]] for item in vocab]).astype(np.float32)
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    norms[norms == 0] = 1
    matrix /= norms
    secret_index = np.array([by_display[word] for word in order], dtype=np.int32)
    # One similarity matrix can be large but 500 x 18k is fine.
    chunk = 80
    n = matrix.shape[0]
    for start in range(0, len(order), chunk):
        stop = min(len(order), start + chunk)
        idxs = secret_index[start:stop]
        sims = matrix[idxs] @ matrix.T
        sims[np.arange(stop - start), idxs] = 2.0
        ranking = np.argsort(-sims, axis=1)
        positions = np.empty_like(ranking, dtype=np.uint16)
        positions[np.arange(stop - start)[:, None], ranking] = np.arange(1, n + 1, dtype=np.uint16)
        for offset, puzzle_id in enumerate(range(start, stop)):
            row = positions[offset]
            secret = int(idxs[offset])
            if int(row[secret]) != 1 or len(np.unique(row)) != n:
                raise SystemExit(f"rank file {puzzle_id} is not a valid permutation")
            blob = bytearray()
            blob += b"SEN1"
            blob += struct.pack("<HH", n, secret)
            blob += row.astype("<u2").tobytes()
            (ranks_dir / f"{puzzle_id}.bin").write_bytes(blob)
        print(f"  wrote ranks {start}..{stop - 1}", flush=True)


def sanity_report(vocab: list[dict], vectors: dict[str, np.ndarray], order: list[str], out_path: Path) -> int:
    by_key = {item["key"]: i for i, item in enumerate(vocab)}
    matrix = np.stack([vectors[item["key"]] for item in vocab]).astype(np.float32)
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    norms[norms == 0] = 1
    matrix /= norms
    lines = []
    weak = 0
    for secret, neighbors in SANITY:
        key = fold_key(secret)
        if key not in by_key:
            lines.append(f"{secret}: NOT IN VOCAB")
            weak += 1
            continue
        index = by_key[key]
        sims = matrix[index] @ matrix.T
        sims[index] = -2
        order_idx = np.argsort(-sims)
        top = [(vocab[int(j)]["display"], int(rank + 1)) for rank, j in enumerate(order_idx[:12])]
        lines.append(secret + ": " + ", ".join(f"{word} #{rank}" for word, rank in top))
        best = None
        for neighbor in neighbors:
            nkey = fold_key(neighbor)
            if nkey not in by_key:
                continue
            rank = int(np.where(order_idx == by_key[nkey])[0][0]) + 1
            best = rank if best is None else min(best, rank)
            lines.append(f"    {neighbor} -> {rank}")
        if best is None or best > 200:
            weak += 1
            lines.append(f"    WARNING best neighbor rank is {best}")
    # Sample calendar days.
    lines.append("")
    for iso in ("2025-09-01", "2025-12-25", "2026-03-08", "2026-07-01", "2026-10-17"):
        day = date.fromisoformat(iso)
        puzzle = (day - EPOCH).days
        if puzzle < 0 or puzzle >= len(order):
            lines.append(f"{iso}: outside calendar ({puzzle})")
            continue
        secret = order[puzzle]
        key = fold_key(secret)
        index = by_key[key]
        sims = matrix[index] @ matrix.T
        sims[index] = -2
        nearest = np.argsort(-sims)[:8]
        rendered = ", ".join(f"{vocab[int(j)]['display']} #{rank + 1}" for rank, j in enumerate(nearest))
        lines.append(f"{iso} puzzle {puzzle}: {secret} | {rendered}")
    report = "\n".join(lines) + "\n"
    out_path.write_text(report, encoding="utf-8")
    print(report)
    return weak


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--freq", type=Path, default=Path("/tmp/sens-cache/ubertext_freq.csv"))
    parser.add_argument("--out", type=Path, default=ROOT / "public" / "data")
    parser.add_argument("--vocab-size", type=int, default=16000)
    parser.add_argument("--min-count", type=int, default=200)
    parser.add_argument("--target-secrets", type=int, default=520)
    parser.add_argument("--precheck", action="store_true")
    parser.add_argument("--refresh-vectors", action="store_true")
    parser.add_argument("--rebuild-order", action="store_true")
    args = parser.parse_args()

    if not args.freq.exists():
        raise SystemExit(f"frequency file not found: {args.freq}")

    curated = load_curated(PIPELINE / "secrets_uk.txt")
    curated_keys = {fold_key(word) for _, word in curated}
    block = load_word_set(PIPELINE / "blocklist_uk.txt")
    stoplist = load_word_set(PIPELINE / "stoplist_uk.txt")
    print(f"curated rows={len(curated)} unique={len(curated_keys)}", flush=True)

    print("reading UberText frequencies…", flush=True)
    nouns, propn, displays = load_frequencies(args.freq, curated_keys, args.min_count)
    print(f"noun candidates={len(nouns)}", flush=True)
    morph = pymorphy3.MorphAnalyzer(lang="uk")
    pool, blocked_hits = build_pool(morph, nouns, propn, displays, block, stoplist, curated_keys)
    print(f"pool after morphology={len(pool)}", flush=True)
    if blocked_hits:
        print("blocked frequent lemmas:", ", ".join(word for _, word in blocked_hits[:20]), flush=True)

    in_pool = {item["key"] for item in pool}
    missing_curated = [word for _, word in curated if fold_key(word) not in in_pool]
    # Dedupe missing for the report.
    seen_missing = set()
    missing_unique = []
    for word in missing_curated:
        key = fold_key(word)
        if key in seen_missing:
            continue
        seen_missing.add(key)
        missing_unique.append(word)
    print(f"curated missing from pool: {len(missing_unique)}", flush=True)
    if missing_unique:
        print("  " + ", ".join(missing_unique[:80]), flush=True)
    if args.precheck:
        return

    # Keep the scan focused: top frequent pool plus every curated lemma that survived.
    pool.sort(key=lambda item: item["count"], reverse=True)
    scan_pool = pool[:24000]
    scan_keys = {item["key"] for item in scan_pool}
    for item in pool:
        if item["key"] in curated_keys and item["key"] not in scan_keys:
            scan_pool.append(item)
            scan_keys.add(item["key"])
    print(f"scanning vectors for {len(scan_pool)} lemmas", flush=True)
    vectors = scan_fasttext(scan_pool, PIPELINE / ".cache", args.refresh_vectors)
    vocab = select_vocab(scan_pool, vectors, curated_keys, args.vocab_size)
    print(f"vocab={len(vocab)} most frequent={vocab[0]['display']} least={vocab[-1]['display']}", flush=True)
    print("top 30:", ", ".join(item["display"] for item in vocab[:30]), flush=True)

    order, dropped = resolve_order(
        vocab,
        curated,
        PIPELINE / "secrets_order.txt",
        args.target_secrets,
        args.rebuild_order,
    )
    if dropped:
        print(f"dropped from order/curated because they lack vectors: {len(dropped)}", flush=True)
        print("  " + ", ".join(dropped[:60]), flush=True)

    args.out.mkdir(parents=True, exist_ok=True)
    vocab_words = [item["display"] for item in vocab]
    (args.out / "vocab.json").write_text(
        json.dumps(vocab_words, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    pairs = build_forms(vocab)
    write_forms(args.out / "forms.bin", pairs)
    manifest = {
        "name": "Сенс",
        "locale": "uk",
        "epoch": EPOCH.isoformat(),
        "puzzleCount": len(order),
        "vocabSize": len(vocab),
        "greenMax": 300,
        "yellowMax": 1500,
        "version": 1,
        "embedding": "fastText cc.uk.300 reduced to vocabulary lemmas",
        "forms": len(pairs),
    }
    (args.out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"forms={len(pairs)} puzzles={len(order)}", flush=True)
    write_ranks(args.out, vocab, vectors, order)
    weak = sanity_report(vocab, vectors, order, PIPELINE / "sanity_report.txt")
    if weak:
        print(f"sanity warnings: {weak}", flush=True)
        sys.exit(2)


if __name__ == "__main__":
    main()
