**1. Task Directory Structure**
The task directory `.hermes/tasks/<TASK_ID>/` is the authoritative execution record.
Minimum files: `TASK.md`, `STATE.json`, `REQUIREMENTS.md`, `EVIDENCE.md`, `PLAN.md`, `DECISIONS.md`, `RESULTS.md`.
Additional files during execution: `ARCHITECTURE.md`, `FACT_CHECK.md`, `TEST_RESULTS.md`, `REVIEW.md`, `REPAIR_LOG.md`, `FINAL_AUDIT.md`.

**2. Task ID Generation**
Format: `NERU-YYYYMMDD-HHMMSS-<short-slug>`.
The same TASK_ID must be used throughout the entire execution. Never create multiple task IDs for repair iterations of the same task.

**3. State Management**
`STATE.json` must be updated after every major phase. It tracks progress, blockers, known unknowns, verified/new APIs, changed files, test failures, and repair counts.

**4. Phase Transitions**
- **RECEIVE**: Normalize task, preserve constraints, identify outcome, create TASK_ID, initialize STATE.json. Transition to CLASSIFY.
- **CLASSIFY**: Determine task class (TRIVIAL, STANDARD, COMPLEX, ARCHITECTURAL). If uncertain, choose the more conservative/higher class. Never downgrade to reduce work.
  - TRIVIAL: Single isolated change. Transition to IMPLEMENT.
  - STANDARD: Limited implementation. Transition to DISCOVER.
  - COMPLEX/ARCHITECTURAL: Multiple modules/dependencies or system-level changes. Transition to DISCOVER.
- **DISCOVER**: Understand the repository before modifying. Identify root, directories, language, framework, package manager, build config, source/test/doc directories, and relevant symbols. Do not modify source code. Output: `EVIDENCE.md` and initial repository map. Transition to EVIDENCE.
- **EVIDENCE**: Determine what is actually known. Divide evidence into VERIFIED, INFERRED, UNKNOWN, CONTRADICTED.
  - VERIFIED: Directly confirmed by repository or authoritative documentation.
  - INFERRED: Logical conclusion but not directly confirmed.
  - UNKNOWN: Not found.
  - CONTRADICTED: Different sources disagree.
  - Implementation MUST NOT treat INFERRED or UNKNOWN as VERIFIED.
  - COMPLEX/ARCHITECTURAL: Transition to REQUIREMENTS.
  - STANDARD: Transition to PLAN.
- **REQUIREMENTS**: Convert user request into atomic requirements (R001, R002, etc.). Each must have ID, DESCRIPTION, SOURCE, ACCEPTANCE CRITERIA, STATUS. No requirement may disappear silently. Transition to PLAN.
- **PLAN**: Describe implementation without modifying repository. Minimum contents: FILES TO MODIFY/CREATE/READ, APIs TO REUSE/CREATE, DEPENDENCIES, RISKS, TEST STRATEGY, ROLLBACK STRATEGY. Every proposed new API MUST be explicitly marked NEW.
  - COMPLEX/ARCHITECTURAL: Transition to ARCHITECT.
  - STANDARD: Transition to IMPLEMENT.
- **ARCHITECT**: Answer WHERE, WHY, HOW, DEPENDENCIES, FAILURE MODE, COMPATIBILITY. Output: `ARCHITECTURE.md`. Must reference actual repository entities (implementation-oriented). Transition to ARCHITECT_REVIEW.
- **ARCHITECT_REVIEW**: Attack the architecture before implementation. Check requirement coverage, abstraction reuse, API invention, module duplication, responsibility placement, circular dependencies, compatibility, failure/persistence/concurrency paths.
  - Fail: Transition to ARCHITECT.
  - Pass: Transition to IMPLEMENT.
- **IMPLEMENT**: Only implement after required evidence and architecture phases. Rules: modify only necessary files, preserve existing APIs, reuse abstractions, no unrelated refactoring, no speculative features, no undocumented behavior, maintain backward compatibility. Transition to STATIC_VERIFY.
- **STATIC_VERIFY**: Determine actual project verification commands (typecheck, lint, build, compile, static analysis) from repository configuration. Never assume a command exists. Run strongest applicable checks.
  - Fail: Transition to REPAIR.
  - Pass: Transition to TEST.
- **TEST**: Run existing relevant tests, new tests, integration tests, build. Record command, exit code, stdout/stderr summary, failure classification.
  - Fail: Transition to REPAIR.
  - Pass: Transition to REVIEW.
- **REVIEW**: Reviewer MUST NOT assume implementation is correct merely because tests pass. Review requirements, architecture, API/doc fidelity, edge cases, failure modes, unintended changes, security/performance implications. Specifically search for hallucinated types, functions, events, components, hooks, env vars, paths, config fields.
  - Fail: Transition to REPAIR.
  - Pass:
    - COMPLEX/ARCHITECTURAL: Transition to DOCUMENTATION_AUDIT.
    - Otherwise: Transition to FINAL_AUDIT.
- **REPAIR**: Not a new task, but another iteration. Increment `iteration` and `repair_count`. Record exact failure, root cause, evidence, fix, verification. Never perform blind regeneration.
- **REVERIFY**: After every repair, run STATIC_VERIFY -> TEST -> REVIEW. Never skip verification.
- **DOCUMENTATION_AUDIT**: Compare final implementation with relevant documentation. Verify documented modules, views, APIs, events, node types, configuration, behavior. If documentation specifies a finite list, verify the entire list explicitly. If documentation and repository disagree, record DOCUMENTATION_CONFLICT and determine authoritative source.
- **FINAL_AUDIT**: Independent of implementation reasoning. Inspect actual final state. Check all requirements (R001...), typecheck, tests, build, documentation audit, API fact check, git diff review, no unrelated modifications, no known unresolved errors.
  - Any mandatory item fails: Transition to REPAIR.
  - Otherwise: Transition to COMPLETE.
- **GIT DIFF AUDIT**: Before completion, inspect `git status --short`, `git diff --stat`, `git diff`. Detect accidental modifications, unrelated refactoring, deleted code, generated files, config changes, debugging code, temporary files, accidental secrets. Remove unrelated modifications before completion unless explicitly requested.
- **COMPLETION GATE**: Orchestrator MUST NOT report DONE unless all hard gates pass (see Tests section).
- **BLOCKED STATE**: Allowed only when progress genuinely cannot continue (missing credentials, unavailable dependency, contradictory spec, corrupted repo, missing file, unavailable test infra, hardware failure). MUST NOT mean "difficult" or "unsure". Before BLOCKED, attempt search, inspect, test, alternative implementation, re-read docs, re-evaluate architecture.
- **BLOCKED REPORT**: Write STATUS: BLOCKED with Task, Blocker, Evidence, What Was Attempted, Why It Failed, What Is Required. Do not fabricate a solution.
- **CONTEXT BUDGET**: Control context size. Never provide entire repository automatically. Default flow: TASK -> REQUIREMENTS -> RELEVANT FILES -> RELEVANT SYMBOLS -> RELEVANT DOCUMENTATION -> EVIDENCE -> MODEL. Add context only when required by current phase.
- **MODEL CALL CONTRACT**: Every heavyweight reasoning call MUST receive: TASK, CURRENT PHASE, REQUIREMENTS, RELEVANT EVIDENCE, KNOWN CONSTRAINTS, KNOWN UNKNOWNs, PREVIOUS DECISIONS, CURRENT ARTIFACT, EXPECTED OUTPUT. Do not ask "Implement this" without context.
- **PASS ISOLATION**: Each model pass has one primary purpose. Do not ask one pass to discover architecture, write code, review, run tests, and decide correctness simultaneously. Preferred separation: ANALYSIS, ARCHITECTURE, IMPLEMENTATION, FACT CHECK, TEST INTERPRETATION, CRITIQUE, REPAIR.
- **ARTIFACT HANDOFF**: Passes communicate through artifacts (ANALYSIS.md, ARCHITECTURE.md, FACT_CHECK.md, TEST_RESULTS.md, REVIEW.md, REPAIR_LOG.md), not memory alone. Next pass reads relevant artifact.
- **DECISION LOG**: Record every important architectural decision (Question, Options, Selected, Reason, Evidence, Rejected alternatives) to prevent repeated reconsideration.
- **NO-CIRCULAR-REASONING RULE**: Model must not approve its own implementation without independent verification. Minimum flow: IMPLEMENTER -> TOOLS/TESTS -> REVIEWER. Same model can perform both roles, but prompts MUST change from CREATOR to CRITIC. Reviewer must attempt to disprove implementation.
- **QUALITY PRIORITY**: Tradeoffs priority: 1. Correctness, 2. Repository compatibility, 3. Requirement coverage, 4. API fidelity, 5. Testability, 6. Maintainability, 7. Performance, 8. Token efficiency, 9. Response speed. Do not sacrifice correctness for speed unless explicitly instructed.
- **LONG TASK STRATEGY**: For tasks requiring many iterations, persist STATE, DECISIONS, EVIDENCE, TEST RESULTS, REVIEW RESULTS, REPAIR HISTORY. Load only what current phase requires. Mandatory for large NERU tasks.
- **FAILURE TAXONOMY**: Classify failures as F001-F015 (see Code section). Every repair entry must reference a failure class.
- **REQUIREMENT COVERAGE GATE**: Completion requires 100% coverage. If a requirement cannot be implemented, mark it BLOCKED explicitly. It must never disappear.
- **QUALITY SCORE**: Diagnostic score calculated from weighted components (see Code section). MUST NOT override hard completion gates. A task with high Q but failing tests is NOT complete.
- **ABSOLUTE RULES**:
  - Never invent an API.
  - Never claim verification without actually verifying.
  - Never claim tests passed without running them.
  - Never claim documentation coverage without checking the documented list.
  - Never silently omit a requirement.
  - Never blindly regenerate code after failure.
  - Never modify unrelated files without justification.
  - Never treat model confidence as evidence.
  - Never treat a plausible implementation as a verified implementation.
  - Never report COMPLETE while a mandatory gate is failing.
- **HANDOFF TO OTHER MODULES**:
  - `EVIDENCE_RESEARCH.md`: Repository/Obsidian/documentation retrieval, symbol search, API verification, evidence packs.
  - `QWEN_MOA.md`: Heavyweight reasoning, architecture/implementation passes, critique, multi-pass reasoning, model context construction.
  - `VERIFICATION_REPAIR.md`: Compiler, tests, lint, runtime verification, failure diagnosis, repair.
  - `NERU_INTEGRATION.md`: NERU-specific architecture, documentation, Memory OS, EventBus, visualization, panels, nodes, project-specific anti-hallucination rules.
  - Orchestrator controls WHEN modules are invoked; modules control HOW specialized work is performed.

**ARCHITEKTURA I PRZEPŁYW DANYCH**
Proces badawczy (Evidence Research) składa się z sekwencyjnych kroków:
1. TASK
2. REPOSITORY STRUCTURE
3. RELEVANT FILE DISCOVERY
4. SYMBOL DISCOVERY
5. DOCUMENTATION
6. OBSIDIAN
7. TESTS
8. CROSS-CHECK
9. EVIDENCE PACK

Zasada nadrzędna: Nie rozpoczynać implementacji, zanim nie zostanie zebrany odpowiedni dowód (evidence).

**KROK 1 — REPOSITORY ROOT**
Określenie korzenia repozytorium.
Inspekcja plików (używaj tylko tych, które faktycznie istnieją, nie zakładaj struktury):
- `package.json`
- `pnpm-workspace.yaml`
- `yarn.lock`
- `package-lock.json`
- `tsconfig.json`
- `vite.config.*`
- `README*`
- `docs/`
- `src/`
- `tests/`

Rejestrowane metadane:
- REPOSITORY_ROOT
- LANGUAGE
- FRAMEWORK
- PACKAGE_MANAGER
- BUILD_SYSTEM
- TEST_FRAMEWORK

**KROK 2 — STRUCTURE MAP**
Budowa lekkiej mapy repozytorium.
Przykład struktury:
```
src/
├── core/
├── agents/
├── memory/
├── ui/
├── visualization/
├── services/
└── utils/

tests/
docs/
```
Zasada: NIE ładuj każdego pliku. Mapa służy do określenia, gdzie szukać dalej.
Zapis: `EVIDENCE.md`

**KROK 3 — TASK TERM EXTRACTION**
Ekstrakcja terminów wyszukiwania z zadania użytkownika.
Przykład zadania: "Add MEMORY and MODELS visualization using existing EventBus."
Termy: MEMORY, MODELS, EventBus, visualization, panel, node.
Generowanie wariantów (np. Memory/memory/MEMORY, EventBus/eventBus/event-bus).
Strategia: Najpierw szukaj dokładnych identyfikatorów, potem wariantów semantycznych.

**KROK 4 — SYMBOL DISCOVERY**
Dla każdego ważnego symbolu:
1. Szukaj dokładnej nazwy.
2. Rejestruj: SYMBOL, FOUND, LOCATION, TYPE, USAGE COUNT, DEFINITION, REFERENCES.

Przykład:
```
SYMBOL: EventBus
STATUS: VERIFIED
DEFINITION: src/core/EventBus.ts
REFERENCES: 17
TYPE: class
PUBLIC METHODS: emit, subscribe, unsubscribe
```

**ZASADA 9 — ABSENCE IS EVIDENCE (NIEOBECNOŚĆ JEST DOWODEM)**
Jeśli symbolu nie można znaleźć, NIE zakładaj, że istnieje.
Przykład: Szukasz `NormalizedEvent`, brak wyniku.
Rejestracja: `NormalizedEvent STATUS: NOT_FOUND`.
Wniosek: API STATUS = UNKNOWN / NOT FOUND.
NIE: "NormalizedEvent prawdopodobnie istnieje."

**ZASADA 10 — API VERIFICATION**
Każdy identyfikator API używany w implementacji MUSI przejść weryfikację.
Wymagane min. jedno z:
- definicja znaleziona w źródle
- OR wiele faktycznych użycia
- OR autorytatywna dokumentacja

Najsilniejsza weryfikacja: definicja + faktyczne użycie + testy.
Przykład:
```
EventBus.emit
definition: src/core/EventBus.ts
usage: src/core/NeruKernel.ts, src/agents/Agent.ts
test: tests/EventBus.test.ts
STATUS: VERIFIED
```

**ZASADA 11 — API CONFIDENCE LEVELS**
Przypisuj poziomy pewności:
- A = definicja + użycie + testy
- B = definicja + użycie
- C = tylko definicja
- D = tylko dokumentacja
- X = nie znaleziono

Implementacja powinna normalnie używać A/B/C. D wymaga ostrożności. X NIE MOŻE być używany jako istniejące API.

**ZASADA 12 — EVENT VERIFICATION**
Zdarzenia wymagają ścisłej weryfikacji.
Dla każdej nazwy zdarzenia szukaj:
- dokładnego stringa zdarzenia
- typu zdarzenia
- enuma zdarzenia
- emit/subscribe w EventBus
- handlera zdarzenia
- dokumentacji
- testów

Przykład: "step.start"
Szukaj: "step.start", step.start, STEP_START, startStep, emit("step.start").
Jeśli nic nie potwierdza zdarzenia: STATUS: NOT VERIFIED. Model NIE MOŻE go używać jako istniejącego.

**ZASADA 13 — TYPE VERIFICATION**
Dla każdego typu szukaj:
- type Name
- interface Name
- class Name
- enum Name
- export type Name
- export interface Name

Przykład: `NormalizedEvent`
Szukaj: `type NormalizedEvent`, `interface NormalizedEvent`, `class NormalizedEvent`, `export.*NormalizedEvent`.
Jeśli nie istnieje: `NormalizedEvent = NOT VERIFIED`. Nie pozwalaj modelowi traktować go jako istniejącego.

**ZASADA 14 — FILE VERIFICATION**
Każdy plik w planie implementacji MUSI być zweryfikowany.
Sprawdź:
- czy istnieje?
- czy ścieżka jest poprawna?
- czy wielkość liter jest poprawna?
- czy rozszerzenie jest poprawne?
Nigdy nie polegaj na wyimaginowanej ścieżce.

**ZASADA 15 — FUNCTION VERIFICATION**
Dla każdej funkcji rejestruj:
- NAME
- FILE
- EXPORT STATUS
- ARGUMENTS
- RETURN TYPE
- CALL SITES
- SIDE EFFECTS

Przykład:
```
emit(
    event: string,
    payload: unknown
): void
```
Nie wnioskuj sygnatury z nazwy. Przeczytaj faktyczną definicję.

**ZASADA 16 — COMPONENT VERIFICATION**
Dla prac UI weryfikuj:
- plik komponentu
- eksport
- props
- state
- hooks
- zależności store
- zależności event
- routing/nawigacja
- zależności CSS/layoutu

Nie twórz duplikatów, jeśli istnieje równoważny komponent.

**ZASADA 17 — CONFIGURATION VERIFICATION**
Zmienne środowiskowe i klucze konfiguracji wymagają dokładnej weryfikacji.
Przykład: `VITE_OBS_REAL`
Szukaj: `VITE_OBS_REAL`, `import.meta.env.VITE_OBS_REAL`, `process.env.VITE_OBS_REAL`, `.env*`, dokumentacja.
Rejestruj: NAME, SOURCE, TYPE, DEFAULT, CONSUMERS, BEHAVIOR.
Nigdy nie wymyślaj zmiennych konfiguracji.

**ZASADA 18 — DOCUMENTATION RESEARCH**
Znajdź dokumentację w: `docs/`, `README*`, `architecture/`, `design/`, `spec/`, `ADR/`.
Następnie przeszukaj Obsidian pod kątem tych samych koncepcji.
Pobieraj dokumentację tematycznie. Nie ładuj całego drzewa dokumentacji.

**ZASADA 19 — OBSIDIAN RESEARCH**
Obsidian traktowany jest jako wiedza projektowa.
Używaj do pobierania:
- decyzji architektonicznych
- historycznych decyzji
- intencji projektowych
- wymagań
- znanych ograniczeń
- TODO
- konwencji
- reguł nazewnictwa
- relacji modułów
- historii implementacji

Obsidian NIE jest automatycznie autorytatywny nad kodem źródłowym.
Jeśli Obsidian mówi, że "EventBus emits event X", a kod źródłowy nie zawiera X:
Rejestruj: CONTRADICTION.
Nie wymyślaj X cicho.

**ZASADA 20 — OBSIDIAN QUERY STRATEGY**
Szukaj progresywnie:
- Level 1: dokładna fraza zadania.
- Level 2: dokładne nazwy symboli.
- Level 3: koncepcje architektoniczne.
- Level 4: powiązana terminologia historyczna.

Przykład: Zadanie "Add MEMORY visualization."
Szukaj: "MEMORY visualization" -> "MEMORY", "memory panel", "memory node", "memory architecture", "visualization memory".
Zatrzymaj rozszerzanie, gdy zebrany zostanie wystarczający dowód. Nie zalewaj kontekstu niepowiązanymi notatkami.

**ZASADA 21 — RELEVANCE FILTER**
Każdy pobrany dokument otrzymuje: RELEVANCE = 0.0 - 1.0.
Rekomendacje:
- 0.9–1.0: bezpośrednio wymagane
- 0.7–0.89: silnie powiązane
- 0.5–0.69: potencjalnie użyteczne
- <0.5: normalnie nie przekazywać do modelu

Nie włączaj materiału o niskiej istotności tylko dlatego, że istnieje.

**ZASADA 22 — EVIDENCE PACK**
Przed przekazaniem zadania do modelu heavyweight, utwórz `EVIDENCE_PACK.md`.
Struktura:
```markdown
# TASK
...

# REQUIREMENTS
R001 ...
R002 ...
R003 ...

# VERIFIED FACTS
F001 ...
F002 ...
F003 ...

# VERIFIED APIS
A001 ...
A002 ...

# VERIFIED FILES
-FILES
...

# VERIFIED EVENTS
...

# VERIFIED TYPES
...

# VERIFIED CONFIGURATION
...

# DOCUMENTATION FACTS
...

# OBSIDIAN FACTS
...

# CONTRADICTIONS
...

# UNKNOWN
...

# DO NOT ASSUME
...
```

**ZASADA 23 — EVIDENCE PACK RULE**
Pakiet dowodów MUSI rozróżniać: FACT vs ASSUMPTION.
Nigdy nie pisz: "EventBus supports step.start." jeśli dowód mówi tylko: "Dokumentacja omawia zdarzenia cyklu życia."
Poprawnie:
```
DOCUMENTATION: Lifecycle events are discussed.
SOURCE: No "step.start" event found.
STATUS: step.start NOT VERIFIED.
```

**ZASADA 24 — NEGATIVE KNOWLEDGE**
Rejestruj ważne rzeczy, które NIE istnieją.
Przykład NOT_FOUND:
- NormalizedEvent
- step.start
- step.end
- security.violation
- ProfilePanel active state

To jest niezwykle ważne. Negatywny dowód powinien być przekazany do modelu kodującego. Zapobiega to regeneracji wcześniej odrzuconych założeń.

**ZASADA 25 — DOCUMENTATION COVERAGE**
Jeśli dokumentacja definiuje skończoną kolekcję:
Wyodrębnij pełną listę.
Przykład:
```
DOCUMENTED VIEWS:
1. OVERVIEW
2. AGENTS
3. MEMORY
4. MODELS
5. EVENTS
```
Nie podsumowuj tego jako "kilka widoków". Dokładna lista staje się częścią pakietu dowodów.

**ZASADA 26 — COUNT VERIFICATION**
Zawsze weryfikuj liczniki z dokumentacji.
Przykłady: 14 panels, 24 nodes, 5 views, 3 layers, 8 event categories.
Pakiet dowodów powinien zawierać:
```
EXPECTED_COUNT: 24
DISCOVERED: 24
MISSING: 0
```
Jeśli:
```
EXPECTED: 24
DISCOVERED: 22
```
Wtedy:
```
STATUS: INCOMPLETE
```
Nie pozwalaj oznaczyć implementacji jako COMPLETE.

**ZASADA 27 — CROSS-SOURCE COMPARISON**
Dla ważnych faktów porównaj:
- SOURCE CODE
- TESTS
- DOCUMENTATION
- OBSIDIAN

Przykład:
```
FACT: Event name
SOURCE: EventBus.ts
Documentation: architecture.md
Obsidian: memory/event-system.md
Tests: EventBus.test.ts
```
Klasyfikuj: CONSISTENT, CONTRADICTED, STALE, UNKNOWN.

**ZASADA 28 — CONTRADICTION HANDLING**
Gdy źródła się różnią:
NIE wybieraj cicho.
Utwórz:
```
CONTRADICTION C001
SOURCE A: ...
SOURCE B: ...
CONFLICT: ...
LIKELY CURRENT: ...
REASON: ...
ACTION: ...
```
Jeśli sprzeczność wpływa na implementację:
Zablokuj implementację do czasu rozwiązania.

**ZASADA 29 — CONTEXT PACKING**
Model reasoning NIE powinien otrzymywać surowego wyjścia wyszukiwania.
Hermes powinien przekształcić dowody na:
- FACT
- SOURCE
- LOCATION
- RELEVANCE
- CONFIDENCE

Przykład:
```
FACT: EventBus exposes emit().
SOURCE: src/core/EventBus.ts
LOCATION: definition
CONFIDENCE: A
RELEVANCE: 1.0
```

**ZASADA 30 — CONTEXT ORDER**
Model powinien otrzymać informacje w tej kolejności:
1. TASK
2. REQUIREMENTS
3. HARD CONSTRAINTS
4. VERIFIED FACTS
5. VERIFIED APIs
6. VERIFIED FILES
7. RELEVANT DOCUMENTATION
8. OBSIDIAN KNOWLEDGE
9. CONTRADICTIONS
10. UNKNOWN ITEMS
11. CURRENT IMPLEMENTATION
12. EXPECTED OUTPUT

Ta kolejność celowo umieszcza twarde fakty przed założeniami.

**ZASADA 31 — UNKNOWN REGISTER**
Utrzymuj: `UNKNOWN_REGISTER.md`.
Przykład:
```
U001: Exact behavior of X when Y occurs.
U002: Whether Z is still used by legacy code.
```
Nieznane nie mogą cicho stać się faktami.

**ZASADA 32 — RESEARCH STOP CONDITION**
Badanie jest wystarczające, gdy:
- wszystkie wymagania mają dowody
- OR wszystkie pliki implementacji są zidentyfikowane
- OR wszystkie ponownie używane API są zweryfikowane
- OR wszystkie krytyczne nieznane są rozwiązane
- OR brak nierozwiązanej sprzeczności wpływającej na implementację

NIE kontynuuj wyszukiwania w nieskończoność.

**ZASADA 33 — RESEARCH FAILURE**
Jeśli wymagany dowód nie może zostać znaleziony:
NIE fabrykuj go.
Rejestruj:
```
RESEARCH_BLOCKER
QUESTION: ...
SEARCHED: ...
RESULT: ...
MISSING: ...
IMPACT: ...
```
Następnie:
- szukaj w szerszym źródle,
- inspekcja historycznej dokumentacji,
- inspekcja historii git,
- poproś o wyjaśnienie,
- oznacz zadanie jako BLOCKED.

**ZASADA 34 — GIT HISTORY RESEARCH**
Gdy bieżący kod sprzecza z dokumentacją:
Inspekcja historii, gdy jest dostępna.
Przydatne komendy:
```bash
git log --all -- <file>
git log -S'<symbol>' --all
git log -G'<pattern>' --all
git blame <file>
```
Używaj historii do określenia:
- przemianowanych API,
- usuniętych zdarzeń,
- zdeprecjonowanych modułów,
- migracji architektonicznych,
- intencjonalnych usunięć.

Nie przywracaj automatycznie historycznego kodu.
Historyczne istnienie NIE oznacza bieżącego istnienia.

**ZASADA 35 — GENERATED CODE**
Pliki generowane muszą być zidentyfikowane.
Przykłady: `dist/`, `build/`, `generated/`, `coverage/`, `.cache/`.
Nie traktuj artefaktów generowanych jako autorytatywnych źródeł implementacji, chyba że zadanie dotyczy wyjścia generowanego.
Preferuj pliki źródłowe.

**ZASADA 36 — DEPENDENCY RESEARCH**
Gdy implementacja wymaga zależności:
Weryfikuj:
- package.json
- lockfile
- istniejące importy
- zainstalowaną wersję
- faktyczne API

Nigdy nie zakładaj najnowszej wersji API.
Używaj wersji faktycznie zainstalowanej w projekcie.

**ZASADA 37 — EXTERNAL API RESEARCH**
Jeśli zadanie używa zewnętrznej biblioteki:
Najpierw inspekcja:
- package.json
- lockfile
- istniejące użycie
- definicje typów
- lokalnie dostępna dokumentacja

Jeśli wymagane jest badanie internetowe, oznacz zewnętrzny dowód osobno:
`EXTERNAL_SOURCE`
Nigdy nie mieszaj zewnętrznej dokumentacji z zweryfikowanymi lokalnymi faktami implementacji.

**ZASADA 38 — EVIDENCE QUALITY SCORE**
Każdy fakt może otrzymać:
- 1.00: definicja źródła + testy
- 0.90: definicja źródła + użycie
- 0.80: definicja źródła
- 0.70: autorytatywna dokumentacja
- 0.50: wiedza projektowa Obsidian
- 0.30: wnioskowanie
- 0.00: założenie modelu

Tylko fakty >= 0.70 powinny normalnie być używane jako dowody implementacji.

**ZASADA 39 — MODEL INPUT CONTRACT**
Model heavyweight MUSI otrzymać:
- TASK
- REQUIREMENTS
- VERIFIED FACTS
- VERIFIED APIs
- VERIFIED FILES
- DOCUMENTATION
- OBSIDIAN
- CONTRADICTIONS
- UNKNOWN
- CURRENT CODE
- EXPECTED ACTION

Model MUSI być wyraźnie poinformowany:
- Tylko VERIFIED fakty mogą być traktowane jako istniejące zachowanie repozytorium.
- UNKNOWN items nie mogą być wymyślane.
- Jeśli wymagany jest UNKNOWN item, zatrzymaj się i poproś o kolejne badanie.

**ZASADA 43 — EVIDENCE PACK SIZE**
Pakiet dowodów powinien być zwięzły.
Preferuj:
- 50 zweryfikowanych faktów
nad:
- 500 stron tekstu źródłowego

Model potrzebuje faktów i powiązanych fragmentów źródła, nie całego projektu.

**ZASADA 44 — SOURCE EXCERPTS**
Gdy wymagany jest dokładny tekst źródłowy, włącz najmniejszy użyteczny fragment.
Przykład:
```
FILE: src/core/EventBus.ts
SYMBOL: emit
EXCERPT: <relevant function>
WHY: Confirms argument signature.
```
Nie włączaj całych plików, jeśli nie jest to wymagane.

**ZASADA 45 — LARGE FILES**
Dla dużych plików:
- zlokalizuj symbol,
- przeczytaj otaczający kod,
- zidentyfikuj zależności,
- pobierz tylko powiązane zakresy.

Nigdy nie przekazuj automatycznie pliku 3000 linii do modelu.

**ZASADA 46 — RESEARCH CACHE**
Wielokrotnie używane dowody mogą być buforowane.
Przykład:
```
.hermes/evidence/
├── repository-map.md
├── api-index.md
├── event-index.md
├── component-index.md
└── configuration-index.md
```
Cache jest ważne tylko, gdy stan źródła się nie zmienił.
Jeśli repozytorium zmienia się znacząco:
Unieważnij odpowiedni cache.

**ZASADA 47 — SOURCE HASHING**
Dla ważnych dowodów, rejestruj rewizję źródła:
```
GIT_COMMIT: <hash>
```
Pozwala to powiązać pakiet dowodów z konkretnym stanem repozytorium.

**ZASADA 48 — STALE EVIDENCE**
Jeśli buforowany dowód pochodzi z poprzedniego commita:
```
STATUS: STALE
```
Przewaliduj przed użyciem do implementacji.
Nigdy nie używaj przestarzałych definicji API bez sprawdzenia bieżącego źródła.

**ZASADA 49 — FINAL EVIDENCE GATE**
Przed implementacją:
Silnik dowodów musi odpowiedzieć na:
- Co zmieniamy?
- Gdzie to zmieniamy?
- Jakie istniejące API używamy?
- Które API są nowe?
- Czego wymaga dokumentacja?
- Czego wyraźnie NIE ma?
- Co pozostaje nieznane?

Jeśli te pytania nie mogą zostać odpowiedziane:
Nie przechodź do implementacji.

**ZASADA 50 — HANDOFF**
Silnik dowodów przekazuje do QWEN_MOA:
- EVIDENCE_PACK.md
- REQUIREMENTS.md
- ARCHITECTURE.md
- UNKNOWN_REGISTER.md
- CONTRADICTIONS.md
- powiązane fragmenty źródła
- powiązane fragmenty dokumentacji

Następny moduł jest odpowiedzialny za przekształcenie tych dowodów w wieloprzejściowe rozumowanie i implementację.

**KONIEC EVIDENCE_RESEARCH.md**

Ta część jest celowo „upierdliwa” w jednym miejscu: **negatywna wiedza**.
W Twoim przypadku to jest bardzo ważne. Qwen nie powinien dostać tylko:

**ARCHITEKTURA I PRZEPŁYW DANYCH (PIPELINE)**

1.  **Standardowy Przepływ (Complex Coding Task):**
    TASK → RESEARCH → PASS 1 (ANALYST) → PASS 2 (ARCHITECT) → PASS 3 (ADVERSARIAL REVIEW) → PASS 4 (IMPLEMENTATION PLANNER) → PASS 5 (CODE GENERATOR) → PASS 6 (CODE REVIEWER) → PASS 7 (REPAIR) → FINAL VALIDATION.
    *Uwaga:* Nie każde zadanie wymaga wszystkich przejść. Złożone architektury i duże zadania kodowe zazwyczaj tak.

2.  **Role Modele (Model Roles):**
    Ten sam model (np. Qwen) może pełnić wiele ról. Wymagane role to:
    *   ANALYST
    *   ARCHITECT
    *   CRITIC
    *   PLANNER
    *   IMPLEMENTER
    *   REVIEWER
    *   REPAIRER
    *   VALIDATOR
    *Zasada:* Nie opisuj modelu jako "you are a helpful coding assistant". Używaj wyraźnych, operacyjnych ról.

3.  **Izolacja Przejść (Pass Isolation):**
    Każde przejście otrzymuje: TASK, EVIDENCE, CURRENT ARTIFACT, ROLE INSTRUCTIONS, OUTPUT CONTRACT.
    *Zasada:* Przejście NIE MOŻE dziedziczyć ukrytych założeń z poprzedniego przejścia. Poprzedni wynik jest dostarczany jawnie.

4.  **Pass 0 — Research:**
    *   Obsługiwane przez: `EVIDENCE_RESEARCH.md`
    *   Wyjście: `EVIDENCE_PACK.md`, `UNKNOWN_REGISTER.md`, `CONTRADICTIONS.md`
    *   Architektura nie jest jeszcze generowana.

5.  **Pass 1 — Analyst:**
    *   Rola: Zrozumienie zadania bez implementacji.
    *   Wejście: TASK, REQUIREMENTS, EVIDENCE_PACK, UNKNOWN_REGISTER, CONTRADICTIONS.
    *   Wyjście: `ANALYSIS.md`
    *   Wymagana struktura `ANALYSIS.md`:
        *   # TASK INTERPRETATION
        *   # EXPLICIT REQUIREMENTS
        *   # IMPLIED REQUIREMENTS
        *   # EXISTING SYSTEM COMPONENTS
        *   # RELEVANT FILES
        *   # EXISTING APIS
        *   # DEPENDENCIES
        *   # CONSTRAINTS
        *   # RISKS
        *   # UNKNOWN ITEMS
        *   # QUESTIONS THAT MUST BE RESOLVED
        *   # COMPLETION CRITERIA
    *   *Zasada:* Analityk NIE MOŻE wymyślać API.
    *   *Przykład dozwolony:* "EventBus appears to be the existing event transport."
    *   *Przykład niedozwolony:* `eventBus.emit("step.start", payload)` (chyba że zweryfikowano).

6.  **Pass 2 — Architect:**
    *   Rola: Projektowanie implementacji.
    *   Wejście: TASK, EVIDENCE_PACK, ANALYSIS.
    *   Wyjście: `ARCHITECTURE.md`
    *   Wymagana struktura `ARCHITECTURE.md`:
        *   # ARCHITECTURAL OBJECTIVE
        *   # CURRENT ARCHITECTURE
        *   # PROPOSED ARCHITECTURE
        *   # COMPONENTS
        *   # DATA FLOW
        *   # EVENT FLOW
        *   # STATE FLOW
        *   # FILE CHANGES
        *   # API CHANGES
        *   # BACKWARD COMPATIBILITY
        *   # FAILURE MODES
        *   # PERFORMANCE
        *   # TEST STRATEGY
        *   # MIGRATION
        *   # ALTERNATIVES CONSIDERED
    *   *Śledzenie (Traceability):* Każdy zaproponowany komponent musi mapować się do: REQUIREMENT + (EXISTING COMPONENT lub EXPLICIT NEW COMPONENT).
        *   Przykład:
            COMPONENT: MemoryView
            REQUIREMENT: R003
            STATUS: NEW
            REASON: No existing component satisfies R003.
    *   *Etykietowanie API:* Każde API w `ARCHITECTURE.md` musi być oznaczone jako: EXISTING, NEW, MODIFIED, UNKNOWN.
        *   Przykład:
            EventBus: EXISTING
            MemoryNodeRegistry: EXISTING
            MemoryViewModel: NEW
        *   *Zasada:* Nieznane (UNKNOWN) API nie mogą wejść do implementacji.

7.  **Pass 3 — Adversarial Review (Critic):**
    *   Rola: Próba złamania architektury. To NIE jest ogólna recenzja jakości.
    *   Aktywnie szuka:
        *   Zmyślonych (hallucinated) API
        *   Brakujących modułów
        *   Brakujących wymagań
        *   Błędnych założeń
        *   Duplikacji komponentów
        *   Błędnych nazw zdarzeń
        *   Błędnych typów
        *   Błędnych ścieżek plików
        *   Sprzeczności architektonicznych
        *   Naruszeń dokumentacji
        *   Niepotrzebnej złożoności
        *   Problemów wydajnościowych
        *   Warunków wyścigu (race conditions)
        *   Niespójności stanów
    *   Wejście: TASK, EVIDENCE_PACK, ANALYSIS, ARCHITECTURE.
    *   Wyjście: `ARCHITECTURE_REVIEW.md`
    *   *Wymagane pytania krytyka:*
        1.  Które zaproponowane API nie są zweryfikowane?
        2.  Które zaproponowane pliki nie istnieją?
        3.  Które wymagania są pominięte?
        4.  Które udokumentowane moduły zostały pominięte?
        5.  Które założenia nie są wspierane dowodami?
        6.  Które nazwy są wymyślone?
        7.  Która istniejąca funkcjonalność jest duplikowana?
        8.  Które zmiany mogą złamać istniejące zachowanie?
        9.  Które części są niepotrzebne?
        10. Co zawiedzie jako pierwsze?
    *   *Format wyjścia krytyka:*
        *   Poziomy: CRITICAL, HIGH, MEDIUM, LOW.
        *   Przykład:
            CRITICAL C001: Architecture uses event "step.start". Evidence pack says NOT VERIFIED.
            ACTION: Replace with verified event or explicitly create new event.
            HIGH C002: MEMORY view omitted.
            ACTION: Add MEMORY view.
            MEDIUM C003: Component duplicates existing NodeRenderer.
            ACTION: Reuse NodeRenderer.
    *   *Regulamin rewizji:*
        *   Jeśli CRITICAL > 0: Architektura MUSI być zrewidowana.
        *   Jeśli HIGH > 0: Architektura POWINNA być zrewidowana.
        *   Oryginalna architektura musi zostać zachowana. Tworzy się `ARCHITECTURE_v2.md`. Nie nadpisywać oryginału podczas rozumowania.

8.  **Pass 4 — Implementation Planner:**
    *   Rola: Konwersja zwalidowanej architektury w dokładną sekwencję implementacji.
    *   Wejście: TASK, EVIDENCE_PACK, ARCHITECTURE_v2, ARCHITECTURE_REVIEW.
    *   Wyjście: `IMPLEMENTATION_PLAN.md`
    *   *Format planu:* Każda zmiana MUSI zawierać:
        *   CHANGE ID
        *   FILE
        *   SYMBOL
        *   ACTION
        *   CURRENT STATE
        *   TARGET STATE
        *   DEPENDENCIES
        *   TEST
        *   RISK
        *   Przykład:
            CHANGE-001
            FILE: src/ui/views/MemoryView.tsx
            SYMBOL: MemoryView
            ACTION: CREATE
            CURRENT: Does not exist.
            TARGET: Render documented MEMORY visualization.
            DEPENDENCIES: NodeRenderer, MemoryStore
            TEST: MemoryView.test.tsx
            RISK: LOW
    *   *Kolejność implementacji (Preferowana):*
        1. types
        2. data structures
        3. core logic
        4. state
        5. event integration
        6. services
        7. UI
        8. visualization
        9. tests
        10. cleanup
        *Uwaga:* Dostosuj do architektury repozytorium. Nie ślepo podążaj za tą kolejnością, jeśli projekt ma inną strukturę zależności.

9.  **Pass 5 — Code Generator:**
    *   Rola: Implementacja dokładnie zgodnie z zwalidowanym planem.
    *   Wejście: TASK, EVIDENCE_PACK, ARCHITECTURE_v2, IMPLEMENTATION_PLAN, RELEVANT SOURCE EXCERPTS.
    *   *Zasada:* Generator NIE MOŻE przeprojektowywać architektury. Jeśli architektura jest błędna, zwróć: `ARCHITECTURE_BLOCKER` zamiast cicho przeprojektowywać.
    *   *Reguły przed akcją:*
        *   Przed tworzeniem symbolu: SEARCH.
        *   Przed użyciem API: VERIFY.
        *   Przed importem: VERIFY.
        *   Przed tworzeniem pliku: VERIFY path.
        *   Przed usuwaniem: VERIFY references.
        *   Przed zmianą nazwy: SEARCH all references.
    *   *Wyjście kodu:* Dla każdego zmienionego pliku: FILE, ACTION, CHANGES, REASON, DEPENDENCIES.
    *   *Uwaga:* Rzeczywista modyfikacja repozytorium jest obsługiwana przez warstwę orkiestracji. Model nie powinien twierdzić, że plik został zmieniony, jeśli narzędzie go nie zmieniło.

10. **Pass 6 — Code Reviewer:**
    *   Rola: Przegląd wygenerowanej implementacji w odniesieniu do dowodów i planu.
    *   Wejście: TASK, EVIDENCE_PACK, ARCHITECTURE_v2, IMPLEMENTATION_PLAN, ACTUAL MODIFIED FILES.
    *   Wyjście: `CODE_REVIEW.md`
    *   *Checklist:*
        *   [ ] requirements complete
        *   [ ] documented modules complete
        *   [ ] existing APIs used correctly
        *   [ ] no invented APIs
        *   [ ] no invented events
        *   [ ] no invented types
        *   [ ] imports valid
        *   [ ] file paths valid
        *   [ ] types correct
        *   [ ] state transitions correct
        *   [ ] event flow correct
        *   [ ] error handling correct
        *   [ ] tests added/updated
        *   [ ] existing tests preserved
        *   [ ] no unnecessary duplication
        *   [ ] no obvious performance regression
    *   *Static Fact Check:* Dla każdego zewnętrznie widocznego identyfikatora (symbol, type, event, constant, env var, route, component, service, store) wykonaj weryfikację. Klasyfikacja: EXISTING, NEW, INVALID, UNKNOWN. UNKNOWN to porażka recenzji.
    *   *Coverage Check:* Porównaj DOCUMENTED REQUIREMENTS vs IMPLEMENTED REQUIREMENTS.
        *   Przykład: R001 ✓, R002 ✓, R003 ✗, R004 ✓. COVERAGE: 3/4. Status: INCOMPLETE.
    *   *API Hallucination Check:* Szukaj każdego nowego API. Jeśli nie istnieje i nie zostało jawnie utworzone: FAIL (twarda porażka).
    *   *Omission Check:* Porównaj implementację z EVIDENCE_PACK, ARCHITECTURE, IMPLEMENTATION_PLAN. Każda duża rozbieżność to OMISSION.
        *   Przykład: ARCHITECTURE: 5 views. IMPLEMENTATION: 3 views. STATUS: FAIL.

11. **Pass 7 — Repair:**
    *   Rola: Naprawa tylko ustaleń z recenzji.
    *   Wejście: ACTUAL CODE, CODE_REVIEW, EVIDENCE_PACK, IMPLEMENTATION_PLAN.
    *   *Zasada:* Przejście naprawcze NIE MOŻE przeprojektowywać niezwiązanych obszarów.
    *   Dla każdej naprawy: FINDING, ROOT CAUSE, FILE, CHANGE, VERIFICATION.
    *   *Pętla naprawcza:*
        *   Maksymalna domyślna liczba pętli: 3.
        *   Algorytm: REVIEW → FAIL? → NO (FINAL VALIDATION) / YES (REPAIR → REVIEW).
        *   Jeśli nadal porażka po 3 naprawach: ESCALATE. Nie regenerować w nieskończoność.

12. **Pass 8 — Final Validator:**
    *   Rola: Określenie, czy zadanie jest faktycznie zakończone.
    *   *Zasada:* Walidator NIE MA PRAWA ulepszać kodu. Określa tylko: PASS, FAIL, BLOCKED.
    *   *Sprawdzany zakres:* requirements, architecture, source, tests, documentation, APIs, events, types, files, configuration.
    *   Wyjście: `FINAL_VALIDATION.md`
    *   Wymagane pola:
        *   TASK STATUS: PASS / FAIL / BLOCKED
        *   REQUIREMENT COVERAGE: X/Y
        *   API VERIFICATION: X/Y
        *   FILE VERIFICATION: X/Y
        *   TEST STATUS: ...
        *   REMAINING RISKS: ...
        *   REMAINING UNKNOWN: ...
        *   REMAINING CONTRADICTIONS: ...

13. **Warunki Twardej Porażki (Hard Pass Conditions):**
    Zadanie może być oznaczone jako PASS tylko jeśli:
    *   Wymagania są kompletne
    *   AND brak krytycznych ustaleń z recenzji
    *   AND brak zmyślonych API
    *   AND brak zmyślonych zdarzeń
    *   AND brak nierozwiązanych sprzeczności implementacji
    *   AND wymagane testy przechodzą

14. **Wynik Jakości (Quality Score):**
    *   Wzór:
        QUALITY =
        0.25 * REQUIREMENT_COVERAGE
        + 0.20 * API_CORRECTNESS
        + 0.15 * ARCHITECTURE_FIDELITY
        + 0.15 * CODE_CORRECTNESS
        + 0.10 * TEST_COVERAGE
        + 0.10 * DOCUMENTATION_FIDELITY
        + 0.05 * COMPLEXITY_CONTROL
    *   Każda składowa: 0.0 - 1.0.
    *   *Zasada:* Nie używaj wyniku do nadpisania twardych porażek.
    *   Przykład: QUALITY: 0.91, STATUS: FAIL, REASON: hallucinated API. Wysoki wynik liczbowy nie kompensuje krytycznej porażki poprawności.

15. **Kary za Halucynacje i Pominięcia:**
    *   *Hallucination Penalty:* Śledź `HALLUCINATION_COUNT` osobno.
        *   Kategorie: H_API, H_EVENT, H_TYPE, H_FILE, H_COMPONENT, H_CONFIGURATION, H_REQUIREMENT.
        *   Przykład: H_API: 0, H_EVENT: 1, H_TYPE: 2, H_FILE: 0.
        *   Pozwala to Hermesowi określić, które tryby awarii są nawracające.
    *   *Omission Penalty:* Śledź `OMISSION_COUNT`.
        *   Kategorie: O_REQUIREMENT, O_MODULE, O_VIEW, O_TEST, O_DEPENDENCY, O_DOCUMENTATION.
        *   Bezpośrednio mierzy tryb awarii: "zaimplementowano większość, ale zapomniano o modułach".

16. **Pamięć Modelu (Model Memory):**
    *   Przechowuj historyczną wydajność w `model_profile.json`.
    *   Przykład:
        ```json
        {
          "model": "qwen",
          "task_family": "architecture",
          "samples": 20,
          "api_hallucination_rate": 0.08,
          "event_hallucination_rate": 0.12,
          "omission_rate": 0.14,
          "repair_success_rate": 0.81
        }
        ```
    *   Wartości muszą być wyliczane z rzeczywistych zadań. Nigdy nie wymyślać statystyk.

17. **Adaptacyjna Liczba Przejść (Adaptive Pass Count):**
    *   Używaj historii modelu do dostosowania przejść.
    *   Niska halucynacja: ANALYST → ARCHITECT → REVIEW → IMPLEMENT → VALIDATE.
    *   Wysoka halucynacja: ANALYST → ARCHITECT → API REVIEW → OMISSION REVIEW → ARCHITECTURE REVIEW → IMPLEMENT → CODE REVIEW → REPAIR → VALIDATE.
    *   Pipeline staje się adaptacyjny.

18. **Specjalizowani Recenzenci (Specialized Reviewers):**
    *   Dla trudnych zadań używaj wielu niezależnych recenzentów.
    *   Rekomendowani: ARCHITECTURE REVIEWER, API REVIEWER, COMPLETENESS REVIEWER, CODE REVIEWER.
    *   Mogą używać tego samego modelu Qwen.
    *   Ważna właściwość: różne prompty, różne cele, niezależne rozumowanie (nie różne wagi modelu).

19. **Niezależne Architektury (Independent Architectures):**
    *   Dla zadań o wysokim ryzyku architektonicznym:
    *   Generuj: ARCHITECTURE_A i ARCHITECTURE_B niezależnie.
    *   Nie pokazuj A do B.
    *   Następnie poproś sędziego (judge) o porównanie.

20. **Sędzia Architektury (Architecture Judge):**
    *   Wejście: TASK, EVIDENCE, ARCHITECTURE_A, ARCHITECTURE_B.
    *   Wyjście:
        *   PREFERRED: A / B / HYBRID
        *   REASON:
        *   ADVANTAGES:
        *   DISADVANTAGES:
        *   RISKS:
        *   REQUIRED MODIFICATIONS:
    *   Sędzia MUSI odwoływać się do dowodów.

21. **Zasada Głosowania (Do Not Majority-Vote Facts):**
    *   Jeśli Model A, B i C mówią, że Event X istnieje, to NIE oznacza, że Event X istnieje.
    *   Dowody z repozytorium decydują o prawdzie. Zgoda LLM nie jest dowodem.

22. **Specjalizowane Recenzje:**
    *   *API Review:*
        *   Wejście: EVIDENCE_PACK, PROPOSED CODE.
        *   Cel: Znajdź każdy identyfikator, którego kod zakłada istnienie. Zweryfikuj każdy z dowodami.
        *   Zwróć tylko: VALID, INVALID, UNKNOWN, NEW.
        *   Ten recenzent powinien być ekstremalnie surowy.
    *   *Completeness Review:*
        *   Wejście: REQUIREMENTS, DOCUMENTATION, IMPLEMENTATION.
        *   Pytanie: Co zostało zapomniane?
        *   Wyjście: MISSING, PARTIAL, COMPLETE.
        *   Bezpośrednio celuje w porażki pominięć.
    *   *Architecture Review:*
        *   Pytanie: Czy implementacja faktycznie podąża za udokumentowaną architekturą?
        *   Sprawdź: nodes, layers, data flow, event flow, components, folders, state, interfaces, visualization.
    *   *Security Review (tylko gdy dotyczy):*
        *   Sprawdź: permissions, secrets, authentication, authorization, input validation, filesystem access, network access, unsafe execution.
        *   Nie wymyślaj wymagań bezpieczeństwa.
    *   *Performance Review (tylko gdy dotyczy):*
        *   Sprawdź: CPU, GPU, memory, network, I/O, rendering, algorithmic complexity, caching, parallelism.
        *   Dla lokalnych LLM sprawdź też: VRAM, RAM, context length, KV cache, batch size, quantization, model loading.

23. **Równoległość Przejść (Pass Parallelization):**
    *   Niezależne recenzje mogą być wykonywane równolegle.
    *   Schemat:
        IMPLEMENTATION → (API REVIEW, COMPLETENESS REVIEW, ARCHITECTURE REVIEW, PERFORMANCE REVIEW) → JUDGE → REPAIR.
    *   Preferowane, gdy dostępna jest moc obliczeniowa.

24. **Strategia Wykonania na RTX 3090:**
    *   3090 to ciężki silnik rozumowania.
    *   Nie wykonuj każdego przejścia sekwencyjnie, jeśli można je zrównoleglić.
    *   Dla niezależnych recenzentów: Instancje Qwen A, B, C mogą działać równolegle, jeśli pamięć na to pozwala.
    *   Jednak wiele pełnych instancji 27B może przekroczyć VRAM.
    *   Domyślnie: jeden załadowany model, wiele sekwencyjnych przejść. Równoległość tylko, gdy konfiguracja runtime na to pozwala.

25. **Wznowienie Kontekstu (Context Reuse):**
    *   Gdy ten sam pakiet dowodów jest ponownie używany: użyj prefix caching (jeśli wspierane).
    *   Stabilny prefiks: SYSTEM, TASK, EVIDENCE_PACK.
    *   Zmienny sufiks: CURRENT PASS, CURRENT ARTIFACT.
    *   Zmniejsza to powtarzalne przetwarzanie promptu.

26. **Zasada Kontekstu Przejścia (Pass Context Rule):**
    *   Nie dodawaj ciągle każdej poprzedniej odpowiedzi.
    *   Źle: TASK, PASS1, PASS2, PASS3... (powoduje bloat kontekstu).
    *   Dobrze: TASK, EVIDENCE, CURRENT ARTIFACT, CURRENT REVIEW.
    *   Podsumuj przestarzałe rozumowanie pośrednie.

27. **Kompresja Artefaktów (Artifact Compression):**
    *   Po każdym głównym przejściu: skompresuj wynik do:
        *   DECISIONS
        *   FACTS
        *   CHANGES
        *   RISKS
        *   OPEN QUESTIONS
    *   Nie zachowuj szczegółowego rozumowania, chyba że wymagane do audytu.

28. **Warunki Stopu (Stop Conditions):**
    *   Zatrzymaj się natychmiast, gdy: FINAL_VALIDATION = PASS.
    *   Nie wykonuj dodatkowych przejść modelu tylko dlatego, że jest więcej mocy obliczeniowej.
    *   Celem jest poprawność, nie zużycie tokenów.

29. **Warunki Eskalacji (Escalation Conditions):**
    *   Eskaluj, gdy:
        *   3 pętle naprawcze zawiodły
        *   OR pozostaje krytyczna sprzeczność
        *   OR brakuje wymaganych dowodów
        *   OR testy nie mogą ustalić poprawności
        *   OR architektura pozostaje niejednoznaczna
    *   Wyjście: BLOCKED (nie "probably correct").

30. **Tryby Zadania (Task Modes):**
    *   *Simple Task Mode:* ANALYST → IMPLEMENT → VALIDATE. (np. zmiana nazwy zmiennej, literówka). Nie marnuj 8 przejść na trywialne zmiany.
    *   *Standard Task Mode:* RESEARCH → ANALYST → ARCHITECT → IMPLEMENT → REVIEW → REPAIR → VALIDATE.
    *   *Complex Architecture Mode:* RESEARCH → ANALYST → ARCHITECTURE A/B → ARCHITECTURE JUDGE → API/COMPLETENESS/ARCHITECTURE REVIEW → IMPLEMENTATION PLAN → IMPLEMENTATION → CODE REVIEW → REPAIR → FINAL VALIDATION.
    *   *Large Refactor Mode:* RESEARCH → SYSTEM ANALYSIS → DEPENDENCY ANALYSIS → ARCHITECTURE A/B → JUDGE → MIGRATION PLAN → PHASE 1 → VALIDATE → PHASE 2 → VALIDATE → PHASE 3 → VALIDATE → FINAL REVIEW.
    *   *Zasada:* Nigdy nie wykonuj dużego refaktoryzacji jako jednego gigantycznego, jednorazowego wygenerowania.

31. **Ograniczenia Generowania Kodu (Code Generation Limit):**
    *   Unikaj proszenia Qwen o generowanie ogromnych ilości kodu w jednym przejściu.
    *   Preferowane: 1–3 ściśle powiązane pliki.
    *   Następnie: review, validate, continue.
    *   Zmniejsza to kaskadowe błędy.

32. **Zasada Granic Plików (File Boundary Rule):**
    *   Każda jednostka implementacji powinna mieć:
        *   jasny cel
        *   ograniczoną powierzchnię zależności
        *   testowalne zachowanie
    *   Jeśli zadanie wymaga 20 plików: podzielić na logiczne fazy.

33. **Test-First (Gdy Możliwe):**
    *   Dla krytycznej logiki:
        ANALYSIS → TEST PLAN → TEST IMPLEMENTATION → IMPLEMENTATION → TEST → REVIEW.
    *   Dostarcza to modelu wykonywalnych ograniczeń.

34. **Test Wierności Dokumentacji (Documentation Fidelity Test):**
    *   Dla zadań architektonicznych twórz końcowe porównanie: DOCUMENTATION vs IMPLEMENTATION.
    *   Przykład:
        *   24 documented nodes vs 24 implemented nodes
        *   5 documented views vs 5 implemented views
        *   3 documented layers vs 3 implemented layers
    *   Każda niezgodność wymaga wyjaśnienia.

35. **Raport Końcowy (Final Report):**
    *   Każde złożone zadanie produkuje: `TASK_REPORT.md`
    *   Struktura:
        *   # TASK
        *   # RESULT (PASS / FAIL / BLOCKED)
        *   # CHANGES
        *   # FILES
        *   # REQUIREMENTS
        *   # TESTS
        *   # API VERIFICATION
        *   # ARCHITECTURE FIDELITY
        *   # HALLUCINATIONS
        *   # OMISSIONS
        *   # REMAINING RISKS
        *   # REMAINING UNKNOWN
        *   # MODEL PASSES
        *   # REPAIR PASSES

36. **Zasada Podstawowa (Principle):**
    *   Model nie jest źródłem prawdy.
    *   Repozytorium jest źródłem prawdy.
    *   Model generuje hipotezy.
    *   Hermes weryfikuje hipotezy.
    *   Repozytorium i testy decydują o poprawności.

37. **Różnica względem zwykłego MoA:**
    *   Najważniejsza różnica: Nie każemy pięciu Qwenom wymyślać rozwiązań i głosować. To byłoby słabe i marnowałoby VRAM/tokeny.
    *   Zamiast tego: Wykorzystujemy izolację przejść, weryfikację dowodów i adaptacyjną głębokość pipeline'u.

**Architektura i Stan**
*   **MoATask**: Definiuje zadanie z trybem (simple, standard, architecture, large_refactor), stanem (pending do blocked), licznikami napraw i referencjami do artefaktów.
*   **MoAPhase**: Enumeracja faz pipeline: od CLASSIFY przez RESEARCH, ANALYZE, ARCHITECT, PLAN, IMPLEMENT, różne typy REVIEW (API, Completeness, Code), REPAIR, VALIDATE do FINALIZE.
*   **ArtifactRef**: Każdy wynik modelu jest artefaktem. Hermes nie przekazuje całej historii rozmowy, tylko referencje do aktualnych artefaktów (id, type, path, hash, version).
*   **PassExecution**: Śledzi wykonanie pojedynczego pasa (rola, model, czas, użycie tokenów, status).

**Maszyna Stanów (State Machine)**
*   Pipeline jest deterministyczną maszyną stanów.
*   **Przepływ**: CLASSIFY → RESEARCH → ANALYZE → ARCHITECT → ARCHITECT_REVIEW.
*   **Gates**:
    *   Jeśli ARCHITECT_REVIEW FAIL → wraca do ARCHITECT.
    *   Jeśli PASS → PLAN → IMPLEMENT.
    *   Po IMPLEMENT: równoległe lub sekwencyjne API_REVIEW, COMPLETENESS_REVIEW, CODE_REVIEW.
    *   Agregator (Judge) decyduje: PASS → VALIDATE → FINALIZE; FAIL → REPAIR → REVIEW.
*   **Retry vs Repair**:
    *   **Retry**: Model nie wygenerował ważnego wyjścia (np. błędny JSON). Powtarzamy ten sam pass.
    *   **Repair**: Model wygenerował ważne wyjście, ale implementacja zawiera błędy. Wykonujemy pass naprawczy.
*   **Max Retries/Repairs**: Domyślnie 2 retrye na pass, 3 pętle napraw. Po przekroczeniu → BLOCKED.

**Routing i Klasyfikacja**
*   **Simple**: ANALYZE → IMPLEMENT → VALIDATE.
*   **Standard**: RESEARCH → ANALYZE → ARCHITECT → IMPLEMENT → REVIEW → REPAIR → VALIDATE.
*   **Architecture**: Dodaje ARCHITECT_REVIEW, PLAN, oraz szczegółowe review (API, Completeness, Code).
*   **Large Refactor**: Rozbija na fazy (Phase 1, 2, 3) z walidacją po każdej.
*   **Klasyfikator**: Szacuje scope, risk, architecture_depth, file_count, dependency_count, unknown_count. Nigdy nie pozwala modelowi wybrać najtańszego pipeline'u tylko dla oszczędności tokenów; wysokie ryzyko wymaga głębszej weryfikacji.

**Kontekst i Pamięć**
*   **Context Budget**: Nie przekazujemy automatycznie wszystkich poprzednich passów. Używamy "CURRENT CONTEXT" zawierającego tylko: TASK, RELEVANT EVIDENCE, CURRENT ARTIFACT, ACTIVE REVIEW, RELEVANT SOURCE.
*   **Context Builder**: Funkcja `buildMoAContext` wybiera tylko potrzebne artefakty dla danej fazy (np. API_REVIEW nie potrzebuje starej architektury, jeśli nie jest to konieczne).
*   **Prefix Caching**: Stała część promptu (System, Rules, Evidence, Task) powinna być identyczna, aby wykorzystać cache. Zmienna część (Role, Current Artifact, Output Contract) jest sufiksem.
*   **Evidence Priority**: Hierarchia wiarygodności:
    *   Level 0: Repozytorium, testy, kompilator.
    *   Level 1: Zweryfikowana dokumentacja.
    *   Level 2: Konfiguracja.
    *   Level 3: Poprzednie wyjścia modelu.
    *   Level 4: Inferencja modelu.
    *   *Reguła*: Wyjście modelu nigdy nie może nadpisać repozytorium ani zweryfikowanej dokumentacji.
*   **Conflict Resolution**: Jeśli model twierdzi, że coś istnieje, a repozytorium/dokumentacja mówią, że nie → wynik INVALID.
*   **Context Deduplication**: Normalizacja i deduplikacja treści pojawiających się w wielu miejscach (dokumentacja, źródło, retrieval).

**Weryfikacja i Naprawa**
*   **Research Phase**: Tworzy EVIDENCE_PACK (files, symbols, types, events, components, config, docs, deps, tests, unknowns, contradictions).
*   **Unknown Register**: Każdy niezweryfikowany element trafia do rejestru UNKNOWN. Model nie może zmienić UNKNOWN na EXISTING bez dowodu.
*   **Review Consensus**: Nie stosujemy głosowania większościowego. Jeśli JAKIKOLWIEK zweryfikowany finding jest critical → REPAIR.
*   **Finding Verification**: Każdy critical/high finding musi zostać zweryfikowany przez przeszukanie repozytorium i porównanie z dokumentacją. Dopiero zweryfikowany finding blokuje pipeline.
*   **Repair Input**: Repair dostaje TASK, EVIDENCE, CURRENT CODE, PLAN, VERIFIED FINDINGS. Nie dostaje całej historii.
*   **Repair Restriction**: Repair może naprawić finding, jego bezpośrednie konsekwencje, testy i dokumentację. Nie może przepisywać niezwiązanej architektury, wprowadzać nowych subsystemów ani zmieniać wymagań.
*   **Blocked State**: System nie może bezpiecznie kontynuować (brak pliku, sprzeczna dokumentacja, brak zależności). Nie fabrykujemy rozwiązań.

**Wykonanie i Optymalizacja**
*   **Model Routing**: Domyślnie jeden model (np. Qwen 27B na 3090). Nie ładujemy wielu kopii modelu tylko dla pozornej równoległości.
*   **Model Keep-Alive**: Model pozostaje załadowany między passami (load once, infer multiple times, unload at end).
*   **Token Budget**: Budżet przypisany per faza (np. analysis: 4000, implementation: 12000). To domyślne wartości, nie twarde limity.
*   **Implementation Chunking**: Jeśli implementacja > 3 plików, rozbić na fazy (types, services, UI, tests).
*   **Large File Rule**: Nie regenerować całego dużego pliku. Używać targeted edit (symbol, location, current code, change).
*   **Output Format**: Każdy pass musi zwracać strukturalne wyjście (JSON). Nie akceptujemy nieustrukturyzowanych esejów.
*   **Invalid Output**: Jeśli walidacja JSON/schema zawiedzie → retry tego samego passa. Nie przekazujemy błędnego wyjścia dalej.
*   **Tool Execution**: Model prosi o akcje narzędzi (fs, git, grep, compiler). Hermes je wykonuje.
*   **Tool Result Trust**: Wynik narzędzia ma wyższy priorytet niż tekst modelu.
*   **Git Checkpoint**: Checkpoint przed złożoną implementacją i po walidacji. Rollback jeśli naprawa jest destrukcyjna.
*   **Safe Execution**: Dla zmian wysokiego ryzyka: branch → implementation → tests → review → validation → merge.
*   **Finalization**: Raport i commit tylko po FINAL VALIDATION = PASS.

**Metryki i Porównania**
*   **Performance Metrics**: Latencja, czas inferencji, czas narzędzi, tokeny, liczba passów/napraw/retry, halucynacje, omissions, testy.
*   **Quality Metrics**: Stopa halucynacji (API, event, type), stopa omissions, stopa sukcesu napraw, stopa sukcesu pierwszego passu.
*   **Model Comparison**: Porównanie modeli (Qwen vs DeepSeek vs Qwen-Coder) na tym samym zestawie zadań. Mierzymy poprawność, halucynacje, omissions, sukces napraw, latencję, tokeny. Nie tylko tok/s.
*   **3090 Optimization**: Priorytet: 1. Jakość modelu, 2. Stabilność kontekstu, 3. Prefix caching, 4. Speculative decoding, 5. Quantization, 6. Throughput. Nie ofiarowujemy poprawności dla tok/s.
*   **Speculative Decoding**: Przydatne dla długiej generacji (implementation, docs). Mniej ważne dla krótkich review.
*   **Lookup-based Drafting**: Przydatne gdy wyjście jest silnie zakorzenione w istniejącym tekście (dokumentacja, transformacje kodu). Nie jest to ulepszenie inteligencji ogólnej.
*   **RAG Mode**: Dla dużych repozytoriów: index → retriever → relevant files → evidence pack → model. Nie wkładamy całego repo do promptu.
*   **Relevance Filter**: Ranking odzyskanego kontekstu na podstawie: symbol, file, dependency, requirement, recent modification, documentation.

**Filozofia**
*   **MoA Definition**: MoA nie oznacza więcej modeli. Może to być 1 model z wieloma specjalizowanymi passami rozumowania.
*   **Purpose**: Celem jest nie "zrobienie, by Qwen myślał dłużej", ale "zrobienie, by Qwen bezpiecznie się mylił". Model, który czasem tworzy świetną architekturę, ale wymyśla API, jest niebezpieczny. Model z pętlą: proposal → criticism → verification → repair → validation jest znacznie bardziej użyteczny.
*   **Final Rule**: Nigdy nie konwertuj "model confidence" w "system truth". Prawda pochodzi z: repozytorium, dokumentacji, narzędzi, testów, zweryfikowanych dowodów. LLM to silnik rozumowania, Hermes to system sterowania.

**1. ARCHITEKTURA OGÓLNA (HERMES)**
*   **Struktura:** USER -> HERMES (Task Controller) -> MoA Orchestrator -> Agents (Research, Analysis, Planning) -> Qwen 27B/3090 -> Reviewers/Tools -> Judge -> Validation -> Final Result.
*   **Komponenty Hermes:** HermesKernel, HermesTaskManager, MoAOrchestrator, ModelRouter, ContextBuilder, EvidenceManager, ArtifactStore, ReviewManager, RepairManager, ValidationManager, MemoryWriter.
*   **Zasada Kernela:** HermesKernel nie powinien zawierać logiki poszczególnych agentów.

**2. ORCHESTRACJA I PIPELINE**
*   **Tryby:** MoA Orchestrator klasyfikuje zadanie do trybów: `simple`, `standard`, `architecture`, `large_refactor`.
*   **Standard Pipeline:** Research -> Analysis -> Architecture -> Architecture Review -> Plan -> Implementation -> Review -> Repair (if required) -> Validation -> Finalize.
*   **Architecture Pipeline:** Dla zadań typu "zaprojektuj nową zakładkę", "przebuduj system pamięci", "dodaj nowy subsystem". Sekwencja: Research -> Analysis -> Architecture -> Architecture Review -> Plan -> Implementation -> API Review -> Completeness Review -> Code Review -> Repair -> Validation.
*   **Multi-Candidate Architecture:** Dla trudnych zadań generowanie dwóch niezależnych architektur (A i B). Judge wybiera: A better, B better, A+B (merge), neither. Nie należy ślepo scalać.
*   **Architecture Diversity:** Drugi pass ma inny cel: "znajdź lepszą alternatywę i zakwestionuj założenia pierwszej architektury", aby zwiększyć szansę na wykrycie błędów strukturalnych.

**3. KONTEKST I DOWODY (EVIDENCE)**
*   **Evidence Pack:** Budowany przed każdym poważnym pass'em. Zawiera: task, phase, artifacts, repository, documentation.
*   **Warstwy Kontekstu (L0-L6):**
    *   L0: SYSTEM
    *   L1: TASK
    *   L2: REQUIREMENTS
    *   L3: VERIFIED EVIDENCE
    *   L4: CURRENT ARTIFACT
    *   L5: REVIEW FINDINGS
    *   L6: OUTPUT CONTRACT
    *   *Zasada:* Nigdy nie ładuj całej historii rozmowy, wszystkich poprzednich odpowiedzi ani całego repozytorium do kontekstu.
*   **Hierarchia Źródeł (Obsidian vs Code):**
    1.  ACTUAL CODE
    2.  TESTS
    3.  GENERATED TOOL OUTPUT
    4.  VERIFIED DOCUMENTATION
    5.  OBSIDIAN NOTES
    6.  PREVIOUS LLM OUTPUT
    *   Obsidian to źródło wiedzy, ale nie bezwarunkowa prawda. W razie konfliktu (np. event X vs Y) Hermes oznacza `CONFLICT`.
*   **Polityka Zapisu do Obsidiana:**
    *   *Zapisujemy:* verified architecture, verified decisions, verified APIs, verified constraints, validated discoveries.
    *   *Nie zapisujemy jako faktów:* model guesses, unverified hypotheses, temporary implementation ideas.
*   **Status Wiedzy:** Każda informacja ma status: `VERIFIED`, `PROBABLE`, `UNKNOWN`, `CONTRADICTED`, `DEPRECATED`.
*   **Memory Update:** Po zakończeniu zadania: Final Result -> Extract Knowledge -> Verify -> Memory Update. Nigdy nie: LLM Output -> Memory bezpośrednio.

**4. ARTEFAKTY I PROWENIENCJA**
*   **Artifact Graph:** Artefakty tworzą graf (Task -> Evidence -> Analysis -> Architecture -> Review -> Plan -> Implementation -> Reviews -> Repair -> Validation). Każdy artefakt wskazuje swoje źródło.
*   **Provenance:** Interfejs zawierający: `sourceType` (repository, documentation, obsidian, tool, llm), `sourceId`, `timestamp`, `verified`, `confidence`.
*   **Transfer Artefaktów:**
    *   *Małe (JSON, Markdown, review):* Przez API.
    *   *Duże (video, dataset, repo archive):* Lokalnie, przekazywane przez path, URI, hash.
    *   *Zasada:* Nie kopiować dużych plików przy każdym pass'ie. Używać shared filesystem / local path.
*   **Hash Validation:** Każdy większy artefakt ma SHA256 w artifact registry, aby wykryć identyczność.
*   **Cache:** Obejmuje: repository retrieval, documentation retrieval, embeddings, prefixes, tool results, validated artifacts. *Nie cache'ować bezwarunkowo:* model answer (jeśli zależy od aktualnego repo).
*   **Stale Data:** Artefakt ma `createdAt`, `sourceHash`, `repositoryCommit`. Jeśli commit się zmienił, artefakt jest `STALE` i wymaga ponownej weryfikacji.

**5. MODELE I ROUTING**
*   **Model Router:** Wybiera model na podstawie: task complexity, available VRAM, context size, latency requirement, required quality.
*   **Primary Model:** Qwen 27B na RTX 3090 dla ciężkiego kodowania.
*   **Light Workers:** Mniejsze modele (np. Qwen 9B) do: classification, file selection, simple extraction, format validation, metadata extraction, small reviews. *Nie* do: architecture, complex refactoring, cross-file reasoning, system design.
*   **Mac Workers:** M4/M2 jako workerowie pomocniczy (9B).
*   **Zasada Nie-Dzielenia Modelu:** Nie dzielić modelu na warstwy między GPU/Mac bez potrzeby (distributed tensor/pipeline parallelism).
*   **MoA vs Model Parallelism:**
    *   MoA: Model -> Role A -> Role B -> Role C (sekwencja ról).
    *   Model Parallelism: Model -> GPU 1 -> GPU 2 -> GPU 3 (fizyczne rozproszenie).
    *   Hermes wykorzystuje przede wszystkim MoA.

**6. WERYFIKACJA I REVIEW**
*   **Final Validation:** Sprawdza: requirements, architecture, files, imports, types, APIs, events, tests, documentation.
*   **Completeness Check:** Kluczowe dla Qwena. Lista `required` vs `implemented`.
*   **API Hallucination Check:** Registry znanych typów/eventów/funkcji. Jeśli model proponuje nieistniejący symbol (np. `NormalizedEvent`), status: `UNVERIFIED API`.
*   **API Review:** Pytanie: "czy każdy użyty symbol istnieje i ma dokładnie takie znaczenie?" (nie "czy wygląda poprawnie?").
*   **Event Review:** Weryfikacja: name, producer, consumer, payload, location.
*   **Component Review:** Weryfikacja: name, file, export, registration, route, state dependency.
*   **Documentation Drift:** Jeśli dokumentacja i kod się różnią (np. Panel ACTIVE vs REMOVED), zgłasza `DOCUMENTATION DRIFT`, nie wybiera samodzielnie wersji.
*   **Repair Priority:** CRITICAL -> HIGH -> MEDIUM -> LOW. Nie marnować pasa na kosmetykę, gdy jest błąd krytyczny.
*   **Repair Batching:** Powiązane błędy (np. missing event + wrong payload) naprawiać razem.
*   **Unrelated Findings:** Nie łączyć błędów logicznych z błędami kosmetycznymi (CSS, README) w jednym passie.
*   **Early Stop:** Jeśli wykryto `verifiedCriticalFinding`, zatrzymaj implementację i wejdź w repair. Nie generuj 12k tokenów kodu, żeby potem odkryć błąd API.
*   **Two-Stage Implementation:**
    1.  Implementation Plan
    2.  Symbol-Level Plan (file, symbol, change, dependency, risk, test)
    3.  Code Generation.
*   **Cross-File Consistency:** Sprawdzenie grafu zależności (imports, types, exports) po implementacji.
*   **Type Consistency:** Sprawdzenie przez compiler (tsc) interfejsów, typów, enumów, sygnatur funkcji.
*   **Zasady Weryfikacji:**
    *   Compiler > LLM (jeśli tsc mówi FAIL, to FAIL).
    *   Tests > LLM (jeśli test mówi FAIL, to FAIL).
    *   No Self-Certification (model nie może sam zatwierdzić PASS).
*   **Role Separation:** Architekt -> Implementer -> Reviewer -> Repairer -> Validator. Nawet jeśli to ten sam model, kontekst musi być inny.
*   **Same Model ≠ Same Context:** Każdy pass dostaje minimalny kontekst właściwy dla roli, aby ograniczyć anchoring i confirmation bias.
*   **Reviewer Prompt Rule:** Reviewer dostaje: Task, Requirements, Evidence, Implementation. *Nie* dostaje: "Model said this is correct".
*   **Blind Review:** Reviewer nie zna wcześniejszej oceny implementera.
*   **Final Judge:** Otrzymuje verified findings, review results, test results, compiler results. Wybiera: PASS, REPAIR, BLOCK.

**7. PAMIĘĆ I OBSIDIAN**
*   **Memory Update After Pass:** Dopiero po `VALIDATION PASS` aktualizujemy pamięć.
*   **Memory Versioning:** Każda zmiana wiedzy: old -> new -> reason -> source -> timestamp.
*   **User Override:** Użytkownik może świadomie zmienić priorytet źródeł (np. "implementuj według kodu, ignoruj starą dokumentację"). Override musi być zapisany jako `OVERRIDE` i obowiązuje tylko dla *current task* (nie całego systemu).

**8. BEZPIECZEŃSTWO**
*   **ToolExecutor:** Osobna warstwa dla komend systemowych. Model proponuje komendę, Hermes decyduje allowed/denied.
*   **Destructive Commands:** `rm`, `git reset --hard`, operacje na dysku/credentialach wymagają explicit policy. Nie mogą być wykonywane wyłącznie na podstawie wygenerowanego tekstu.

**9. OBSERWOWALNOŚĆ I LOGI**
*   **Hermes Internal Events:** `task.created`, `phase.started`, `phase.completed`, `artifact.created`, `review.started`, `review.completed`, `repair.started`, `repair.completed`, `validation.started`, `validation.completed`, `task.completed`, `task.blocked`.
*   **Zasada Eventów:** Nie utożsamiać Hermes Internal Events z eventami NERU (aplikacji), jeśli nie są zdefiniowane w kodzie NERU.
*   **Important Event Rule:** Nie generować automatycznie eventów (np. `security.violation`) tylko dlatego, że są wygodne. Najpierw sprawdzić repository/dokumentację/registry.
*   **Execution Log:** JSON z danymi: task, phase, model, status, findings, verified, unverified, next.
*   **Task Report:** Finalny raport zawierający: Task, Model, Passes, Repairs, Tokens, Latency, Architecture (verified/rejected), Implementation (files changed), Reviews (API, completeness, code), Validation (tests, compiler, repository), Unresolved items.

**10. JAKOŚĆ I BENCHMARKI**
*   **Quality Score:** `correctness + completeness + evidence adherence + test success - hallucinations - unresolved findings`. Służy do porównywania eksperymentów, nie jest "prawdą".
*   **Benchmark Mode:** Tryb uruchamiający identyczne zadanie w wariantach:
    1.  Qwen
    2.  Qwen + MoA
    3.  Qwen + MoA + repair
    4.  Qwen + MoA + tools
*   **Benchmark Data:** Mierzy: first-pass correctness, final correctness, hallucination count, omission count, repair count, latency, tokens.

**11. FINALNA STRUKTURA SYSTEMU (NERU)**
*   **Docelowy Pipeline dla NERU:**
    User Request -> Hermes -> Research -> Evidence Pack -> Qwen Architect -> Architect Review -> API Verification -> Completeness Check -> Implementation Plan -> Qwen Implementer -> Compiler -> API Review -> Completeness Review -> Code Review -> Repair -> Tests -> Final Validation -> Obsidian Update -> Final Response.
*   **Najważniejsza Zasada:** Hermes nie ma sprawić, że Qwen jest "mądrzejszy". Ma stworzyć system (Qwen + evidence + tools + multiple passes + independent review + repair + compiler + tests + memory), który jest odporny na typowe błędy modelu (halucynacje, niekompletność).
*   **Różnica od zwykłego promptu:** Te 5 części (Kernel, Orchestrator, Evidence, Review, Memory) definiują mechanizm wykonawczy, a nie tylko zestaw instrukcji.

**1. Source Priority & Override**
The default source priority order is:
1. ACTUAL EXECUTABLE CODE
2. COMPILER / TYPE SYSTEM
3. AUTOMATED TESTS
4. ACTUAL TOOL OUTPUT
5. CURRENT ARCHITECTURE DOCUMENTATION
6. VERIFIED PROJECT NOTES
7. OBSIDIAN / MEMORY
8. PREVIOUS LLM OUTPUT
9. LLM GENERAL KNOWLEDGE

This ordering is a default. It may be overridden for a specific task, but the override MUST be explicit. An override applies only to that task unless explicitly promoted.

**5. Fact States**
Every important claim must have one of the following states:
*   **VERIFIED**: Evidence directly confirms the claim.
*   **UNVERIFIED**: Claim exists but evidence has not yet been checked.
*   **CONTRADICTED**: Reliable sources disagree.
*   **UNKNOWN**: There is insufficient information to determine truth.
*   **STALE**: The source existed previously but is no longer current.
*   **DEPRECATED**: The source explicitly identifies the item as obsolete.
*   **ASSUMED**: The system temporarily uses an assumption because the task allows it.

**6. No Silent Assumptions**
Hermes must never silently convert `UNKNOWN` into `TRUE`. If an assumption is necessary, it must be explicitly recorded with an ID, statement, status, reason, and a flag indicating if verification is required.

**8. Task Types**
Hermes must classify every task into one primary type from the following list:
QUESTION, RESEARCH, EXPLANATION, CODE_FIX, CODE_CHANGE, FEATURE, REFACTOR, ARCHITECTURE, ARCHITECTURE_CHANGE, DEBUG, DOCUMENTATION, ANALYSIS, AUDIT, MIGRATION, LARGE_REFACTOR, SYSTEM_DESIGN.
A task may additionally have secondary tags.

**9. Complexity Classification**
*   **TRIVIAL**: Single known fact or tiny isolated operation.
*   **LOW**: One file or simple deterministic operation.
*   **MEDIUM**: Multiple files or moderate reasoning.
*   **HIGH**: Cross-file architecture or significant implementation.
*   **VERY_HIGH**: Large architecture, multiple subsystems, extensive dependencies.
*   **CRITICAL**: Changes core infrastructure, memory, orchestration, security, persistence, or other high-impact system components.

**10. Task Routing**
Hermes must NOT immediately call the main model. The flow is:
USER REQUEST → NORMALIZATION → CLASSIFICATION → REQUIREMENT EXTRACTION → COMPLEXITY ESTIMATION → ROUTE SELECTION → MODEL EXECUTION.

**11. Routing Matrix**
*   **TRIVIAL**: → direct response
*   **LOW**: → single model pass
*   **MEDIUM**: → research → reasoning → validation
*   **HIGH**: → evidence → architecture/reasoning → independent review → implementation → validation
*   **VERY_HIGH**: → evidence → multiple reasoning passes → architecture candidates → judge → implementation → multi-review → repair → validation
*   **CRITICAL**: → full Hermes pipeline → explicit approval gates → extensive validation

**12. Direct Response Route**
Only use direct response when:
*   no repository changes are required,
*   no external tools are required,
*   no architectural reasoning is required,
*   no important uncertainty exists.

**13. Standard Engineering Route**
For CODE_FIX, CODE_CHANGE, FEATURE, DEBUG:
TASK → EVIDENCE → ANALYSIS → PLAN → IMPLEMENTATION → VALIDATION → FINAL.

**14. Architecture Route**
For ARCHITECTURE, ARCHITECTURE_CHANGE, SYSTEM_DESIGN, LARGE_REFACTOR:
TASK → EVIDENCE → REQUIREMENT MATRIX → ARCHITECTURE A → ARCHITECTURE REVIEW → ARCHITECTURE B → COMPARATIVE JUDGE → SELECTED ARCHITECTURE → IMPLEMENTATION PLAN → IMPLEMENTATION → VALIDATION.

**15. High-Risk Code Route**
For changes involving memory, database, agent orchestration, model routing, authentication, security, filesystem, persistent state, core event system:
EVIDENCE → ARCHITECTURE → RISK REVIEW → PLAN → IMPLEMENTATION → STATIC VALIDATION → TESTS → SECOND REVIEW → FINAL VALIDATION.

**16. Hermes State Machine**
The task state machine is:
CREATED → NORMALIZING → CLASSIFYING → GATHERING_EVIDENCE → BUILDING_REQUIREMENTS → ANALYZING → ARCHITECTING → ARCHITECTURE_REVIEW → PLANNING → IMPLEMENTING → STATIC_VALIDATION → REVIEWING → REPAIRING → TESTING → FINAL_VALIDATION → MEMORY_UPDATE → COMPLETED.
Not every task requires every state.

**17. Valid State Transitions**
Allowed transitions include:
CREATED → NORMALIZING
NORMALIZING → CLASSIFYING
CLASSIFYING → GATHERING_EVIDENCE
GATHERING_EVIDENCE → BUILDING_REQUIREMENTS
BUILDING_REQUIREMENTS → ANALYZING
ANALYZING → ARCHITECTING
ARCHITECTING → ARCHITECTURE_REVIEW
ARCHITECTURE_REVIEW → PLANNING
PLANNING → IMPLEMENTING
IMPLEMENTING → STATIC_VALIDATION
STATIC_VALIDATION → REVIEWING
REVIEWING → REPAIRING
REPAIRING → STATIC_VALIDATION
REVIEWING → TESTING
TESTING → FINAL_VALIDATION
FINAL_VALIDATION → MEMORY_UPDATE
MEMORY_UPDATE → COMPLETED

**18. Failure Transitions**
Any phase may transition to: BLOCKED, FAILED, CANCELLED.
Example: ARCHITECTURE_REVIEW → BLOCKED if critical evidence cannot be resolved.

**19. Blocked vs Failed**
*   **BLOCKED**: The system cannot safely continue because information or permission is missing (e.g., Required API cannot be verified).
*   **FAILED**: The system attempted the operation and it did not succeed (e.g., TypeScript compilation failed after repair).
These states must not be conflated.

**20. Retry Policy**
A failure does NOT automatically justify repeating the same prompt.
Bad: FAIL → same prompt → FAIL → same prompt.
Correct: FAIL → diagnose failure → modify strategy → retry.
Every retry must record the attempt number, previous failure, and strategy change.

**21. Retry Limit**
Default: MAX_REPAIR_CYCLES = 3.
For critical tasks: MAX_REPAIR_CYCLES = 5.
After the limit: BLOCKED, unless the user explicitly requests continued experimentation.

**23. Phase Contract**
Every phase must define:
INPUT, OBJECTIVE, ALLOWED TOOLS, FORBIDDEN ACTIONS, OUTPUT, SUCCESS CONDITIONS, FAILURE CONDITIONS.
No phase should exist only as a vague instruction.

**25. Requirement Types**
Every requirement must be one of:
FUNCTIONAL, ARCHITECTURAL, TECHNICAL, UI, PERFORMANCE, COMPATIBILITY, SECURITY, DOCUMENTATION, VALIDATION, CONSTRAINT.

**27. Requirement Extraction Rule**
Hermes must distinguish EXPLICIT REQUIREMENT from MODEL INTERPRETATION.
Example: User says "14 paneli" (Explicit). Model saying "therefore ProfilePanel should remain active" is interpretation and must not automatically become a requirement.

**35. User Intent vs Model Intent**
Hermes must preserve the user's actual objective. The model may propose "rewriting the entire architecture" even when the user requested "add one component". Hermes must reject scope expansion unless justified.

**37. Scope Expansion**
If implementation discovers a required change outside scope:
DISCOVERED DEPENDENCY → SCOPE EXPANSION REQUEST → USER / POLICY DECISION.
Do not silently expand. For low-risk mechanical dependencies, Hermes may permit automatic expansion if the task policy allows it.

**40. Critical Rule**
The LLM may propose.
Hermes decides.
Tools verify.
Compiler validates types.
Tests validate behavior.
Memory stores verified knowledge.
No single component is allowed to perform all five roles.

**41. Agent Model**
Hermes uses role separation. A role is not necessarily a separate model. The same Qwen model may execute multiple roles, but:
*   each role receives a different system instruction,
*   each role receives only the context required for that role,
*   each role has a different output contract,
*   reviewer roles must not inherit the implementer's conclusions as facts.

Default roles:
1. RESEARCHER
2. REQUIREMENT_ANALYST
3. ARCHITECT
4. ARCHITECT_REVIEWER
5. ALTERNATIVE_ARCHITECT
6. ARCHITECT_JUDGE
7. PLANNER
8. IMPLEMENTER
9. API_AUDITOR
10. COMPLETENESS_AUDITOR
11. CODE_REVIEWER
12. TEST_ANALYST
13. REPAIRER
14. FINAL_VALIDATOR
15. MEMORY_CURATOR

Optional roles:
16. DEBUGGER
17. SECURITY_REVIEWER
18. PERFORMANCE_REVIEWER
19. DOCUMENTATION_REVIEWER

**100. MOA PASSES**
Hermes supports: PARALLEL_PASS, SEQUENTIAL_PASS, DEPENDENT_PASS, VERIFICATION_PASS, JUDGE_PASS, SYNTHESIS_PASS, REPAIR_PASS.

**101. PARALLEL PASS**
Agents receive the same task and evidence. They do not receive each other's conclusions. Purpose: reduce anchoring.

**102. SEQUENTIAL PASS**
The next agent receives the previous artifact. Used when critique requires access to a specific proposal.

**103. DEPENDENT PASS**
The next pass requires a specific artifact. Architecture cannot begin until mandatory requirements have been established.

**104. VERIFICATION PASS**
A verification agent receives CLAIM + SOURCE + TOOL OUTPUT and determines whether the claim is supported.

**105. JUDGE PASS**
The Judge receives multiple candidates. It must not blindly synthesize them. It must first evaluate them (Comparison -> Evidence Check -> Decision).

**106. SYNTHESIS PASS**
Synthesis is allowed only after candidate evaluation + conflict analysis + evidence verification. The synthesizer may combine compatible elements. It may NOT merge contradictory claims simply because they appear useful.

**109. AGENT INDEPENDENCE**
Parallel agents must not see other agent output, score, confidence, or conclusion until the independent pass is complete. Otherwise, it is not independent.

**110. INDEPENDENT ARCHITECTURE MOA**
Default: 3 architecture candidates. Do not use 5 candidates automatically. Three independent candidates usually provide enough diversity while keeping inference cost manageable.

**111. ARCHITECTURE DIVERSITY**
Candidates must use different reasoning strategies (e.g., minimal_change, clean_architecture, existing_system_alignment). This is preferable to three identical prompts.

**115. REQUIREMENT VERIFICATION**
Every newly discovered requirement must pass SOURCE CHECK. Possible result: VERIFIED, INFERRED, or UNSUPPORTED. Only VERIFIED requirements become mandatory.

**116. OMISSION DETECTION**
Hermes must specifically calculate: requirements_in_source - requirements_in_candidate. This is more important than asking "Is this architecture complete?" because the latter invites subjective judgment.

**117. EVIDENCE PACK**
The Evidence Pack is the central object passed between MoA stages.

**122. EVIDENCE PACK VERSIONING**
Whenever verified evidence changes, the version increments (EP-01 -> EP-02). Do not silently mutate an Evidence Pack. This allows Hermes to determine which reasoning used which facts.

**123. CONTEXT BUILDER**
The Context Builder creates a role-specific prompt using Evidence Pack + Role + Task + Relevant artifacts.

**124. CONTEXT BUDGET**
Context must be budgeted. Do not send every available document to every agent. Priority: 1. mandatory requirements, 2. directly relevant source files, 3. directly relevant documentation, 4. dependency definitions, 5. existing tests, 6. architecture notes, 7. broader context.

**125. CONTEXT TRIMMING**
If context exceeds the role budget: remove irrelevant material, preserve mandatory requirements, preserve authoritative evidence, preserve direct dependencies, preserve unresolved conflicts. Never remove mandatory requirement, critical conflict, or API verification evidence merely to fit the context window.

**127. MODEL CLAIM OBJECT**
Every important model-generated claim can be represented as a ModelClaim object.

**128. CLAIM VERIFICATION**
The verifier evaluates CLAIM + EVIDENCE, not CLAIM + MODEL CONFIDENCE.

**129. CONFIDENCE**
Confidence is not truth. A 94% model confidence is irrelevant if repository matches are 0.

**131. DISAGREEMENT TYPES**
FACTUAL, ARCHITECTURAL, REQUIREMENT, API, SCOPE, PERFORMANCE, IMPLEMENTATION.

**132. DISAGREEMENT HANDLING**
Do NOT immediately vote. Instead: DISAGREEMENT -> CLASSIFY -> CHECK EVIDENCE -> VERIFY -> RESOLVE.

**133. FACTUAL DISAGREEMENT**
The winning answer is the verified one, not the majority (2 vs 1).

**134. ARCHITECTURAL DISAGREEMENT**
Judge evaluates: existing infrastructure, requirements, complexity, risk, testability. No majority vote.

**135. SYNTHESIS RULE**
The synthesizer may combine verified elements from different candidates only if they are compatible.

**137. JUDGE SCORING**
The Judge may use a structured score (correctness, requirement_coverage, evidence_alignment, compatibility, simplicity, maintainability, testability, risk). Risk is inverted when calculating the total.

**138. RECOMMENDED WEIGHTS**
For architecture: correctness: 0.25, requirement_coverage: 0.20, evidence_alignment: 0.20, compatibility: 0.15, simplicity: 0.08, maintainability: 0.05, testability: 0.05, risk: 0.02. The weights are configurable.

**139. SCORE IS NOT FINAL AUTHORITY**
A candidate with a high score must lose to a lower score if the high-score candidate contains a critical unsupported API. Hard validation gates override numeric scores.

**140. HARD GATES**
Before candidate selection: IF invented critical API -> REJECT; IF mandatory requirement missing -> REJECT; IF architecture contradicts verified constraint -> REJECT; IF destructive/unapproved operation -> REJECT.

**141. CANDIDATE STATUS**
Each candidate: VALID, CONDITIONALLY_VALID, INVALID, BLOCKED. Only VALID and CONDITIONALLY_VALID may reach Judge selection.

**143. MOA STOPPING RULE**
Do not run more agents merely because more agents are available. Stop when: requirements stable + critical disagreements resolved + candidate quality converges + verification gates pass.

**145. NON-CONVERGENCE**
If agents disagree on a critical architectural decision, run targeted verification, not another generic architecture generation pass.

**147. MOA COST CONTROL**
Hermes should minimize expensive Qwen passes. Default architecture task: 1 Research, 2 Requirement analysts, 3 Architecture candidates, 1 Architecture judge, 1 Planner, 1 Implementer, 1 API audit, 1 Completeness audit, 1 Code review, 1 Repair, 1 Final validation. Not every stage must use the 27B model.

**148. QWEN 27B PRIORITY**
Use Qwen 27B for: complex architecture, tradeoff analysis, large refactors, implementation, difficult debugging, code review, repair. Do not waste Qwen 27B on: exact symbol lookup, file existence, simple grep, compiler status, test exit code.

**149. TOOL/MODEL DIVISION**
TOOLS answer "Does it exist?". MODEL answers "What should we do with it?".

**153. CODE CANDIDATE RULE**
Two implementations may be generated when implementation risk >= HIGH. Otherwise use one implementation plus review.

**156. MOA AUDIT TRAIL**
Every MoA execution must be reconstructable. Store: task, evidence version, role, model, prompt version, candidate, verification, judge, decision, repair, final validation. This makes it possible to answer: "Why did Hermes choose this architecture?"

**157. PROMPT VERSIONING**
Every role prompt must have a version (e.g., RESEARCHER-v3.0). A change to a role contract increments the version.

**158. REPRODUCIBILITY**
Record: model, quantization, temperature, top_p, max_tokens, seed, prompt_version, evidence_pack. If the backend does not support seed control: seed: UNSUPPORTED. Do not fabricate reproducibility.

**159. TEMPERATURE**
Suggested defaults: researcher: 0.1, requirements: 0.1, architect: 0.4, alternative_architect: 0.6, judge: 0.1, planner: 0.2, implementer: 0.2, reviewer: 0.1, repairer: 0.2, validator: 0.0. Backend-specific limitations must be respected.

**160. TEMPERATURE RULE**
Higher temperature is useful for: candidate diversity, alternative designs, creative solution search. Lower temperature is preferred for: verification, judging, API checking, requirement auditing, final validation.

**161. MOA MEMORY RULE**
Do not store every candidate in long-term memory. Persist: selected architecture, verified decisions, important rejected alternatives, reason for rejection when durable. Do not persist: all intermediate drafts, all failed prompts, all temporary candidates.

**162. FAILURE RECOVERY**
If one parallel agent fails, Hermes may continue with the successful ones. It does not automatically rerun all agents.

**163. QUORUM**
Default minimum for a 3-agent architecture MoA: 2 successful candidates. If only one candidate succeeds: do not call this consensus. Use: single candidate + adversarial review.

**164. CONSENSUS DEFINITION**
Hermes uses CONSENSUS only when independent agents converge on compatible conclusions AND those conclusions pass evidence verification. Two agents agreeing on a hallucinated API is NOT consensus.

**168. CORE MOA RULE**
MORE MODELS ≠ MORE TRUTH. MORE INDEPENDENT REASONING + BETTER EVIDENCE + TARGETED VERIFICATION + STRICT JUDGING = MORE RELIABLE OUTPUT.

**169. SECOND CORE RULE**
Never ask an LLM to verify something that a deterministic tool can verify more reliably. LLM: architecture, reasoning, tradeoffs, implementation. TOOLS: existence, syntax, types, imports, exports, tests, diff, file paths, exact strings.

**170. THIRD CORE RULE**
Never let synthesis hide disagreement. If agents disagree, disagreement must remain visible until resolved. A clean final answer is not more important than preserving the uncertainty that produced it.

**171. FOURTH CORE RULE**
The Judge is not an oracle. The Judge can also be wrong. Therefore: JUDGE -> IMPLEMENTATION -> AUDIT -> VALIDATION must remain in place.

**172. FIFTH CORE RULE**
The final validator has authority to reject the entire MoA result. Even if 3 architects agree + judge says PASS + implementer says PASS, Final Validator may return FAIL when evidence contradicts the result.

**173. PURPOSE**
This section defines HOW Hermes executes the MoA architecture described in PART 3. The execution environment may contain heterogeneous workers (MACHINE-A: RTX 3090, MACHINE-B: Mac M4, MACHINE-C: Mac M2). The system must treat these machines as heterogeneous workers. They are NOT assumed to have equal performance, run the same model, or have identical context capacity.

**174. FUNDAMENTAL EXECUTION PRINCIPLE**
Hermes separates: ORCHESTRATION, INFERENCE, STORAGE, VERIFICATION, TOOL EXECUTION. A machine may perform more than one function.

**175. DO NOT FORCE SYMMETRY**
Never require M4, M2, RTX 3090 to run identical workloads. Instead assign work according to: capability, latency, memory, model availability, current load.

**176. WORKER CAPABILITY MODEL**
Each worker publishes its capabilities.

**Architektura i Procesy (Sekcje 284–323)**

*   **Proces Naprawy (Repair Process):**
    *   Przepływ: CANDIDATE → FACT CHECK → FAIL → REPAIR SPEC → MODEL → PATCH → FACT CHECK → PASS.
    *   Maksymalna liczba iteracji naprawy: 3 (chyba że skonfigurowano inaczej).
    *   **REPAIR SPEC (284):** Przykład specyfikacji naprawy:
        *   REPAIR-001: Usuń `NormalizedEvent`.
        *   REPAIR-002: Zamień `step.start` na rzeczywiste zdarzenie runtime.
        *   REPAIR-003: Dodaj widok MEMORY.
        *   REPAIR-004: Dodaj widok MODELS.
        *   REPAIR-005: Usuń `ProfilePanel` (oznaczony jako usunięty).
        *   Agent naprawy otrzymuje TYLKO niezbędne dowody.
    *   **Lokalność Naprawy (285):** Nie prosić o "przepisanie całej architektury". Zamiast tego: "Popraw te pięć zweryfikowanych rozbieżności". Redukuje to ryzyko regresji.

*   **Metryki i Benchmarki (286–288):**
    *   **Hallucination Score (286):**
        *   `hallucination_rate = unsupported_claims / total_verifiable_claims`.
        *   Przykład: 4 / 40 = 10%.
        *   Śledzenie per model.
    *   **Model Benchmark (287):** Hermes przechowuje: model, typ zadania, tokeny, latencję, nieuzasadnione twierdzenia, pominięcia, błędy testów, liczbę napraw.
        *   Przykład dla `qwen3.8-27b`:
            *   architecture: unsupported_claim_rate: 0.08, omission_rate: 0.06, repair_rate: 0.17.
            *   coding: compile_failure_rate: 0.04.
    *   **Model Routing Learning (288):** W czasie:
        *   architecture → model A
        *   implementation → model B
        *   API verification → deterministic tools
        *   Nie zakładaj, że jeden model jest optymalny dla każdego zadania.

*   **Zasady Generowania i Weryfikacji (289–295):**
    *   **Independence Requirement (289):** Kandydaci A, B, C nie mogą otrzymywać odpowiedzi innych. Inaczej powstaje "false consensus".
    *   **Blind Review (290):** Reviewer otrzymuje kandydata + wymagania + dowody, ALE NIE informację "inny model ocenił to na 9/10". Redukuje to anchoring.
    *   **Evidence-First Prompt (291):** Każdy agent architektoniczny otrzymuje: "Nie wymyślaj API. Jeśli nazwa nie występuje w dostarczonych dowodach, oznacz ją jako UNKNOWN."
    *   **Unknown is Valid (292):** System musi pozwalać na `UNKNOWN` zamiast wymuszać YES/NO.
        *   Przykład: Event type: UNKNOWN → tworzenie verification job.
    *   **Never Resolve Unknown by Guessing (293):**
        *   Źle: "Prawdopodobnie EventBus emituje step.start."
        *   Dobrze: "Typ zdarzenia niezweryfikowany. Wyszukaj w repozytorium."
    *   **Source Search (294):** Preferowane narzędzia: `rg`, `git grep`, filesystem search, TypeScript compiler, test runner. Szukaj dokładnych nazw przed pytaniem LLM.
    *   **Documentation Search (295):** Szukaj dokładnego terminu, aliasów, inspekcji otaczającej sekcji. Nie traktuj semantycznej podobieństwa jako dowodu istnienia.

*   **Walidacja Techniczna (296–303):**
    *   **Typecheck (296):** Użyj `tsc --noEmit` lub autorytatywnego odpowiednika projektu. Nigdy nie wymyślaj komendy, jeśli konfiguracja pakietu definiuje inną. Najpierw inspekcja: `package.json`, `scripts`, `tsconfig`.
    *   **Build Validation (297):** Użyj rzeczywistej komendy build repozytorium (np. `npm run build` TYLKO jeśli skrypt istnieje).
    *   **Test Validation (298):** Użyj definicji test runnera repozytorium (np. `npm test`, `vitest`, `jest`, `playwright`). Nie zakładaj jednego.
    *   **Runtime Validation (299):** Uruchom aplikację, wykonaj ścieżkę docelową, obserwuj wynik. Kompilacja to nie runtime.
    *   **UI Validation (300):** Weryfikuj: istnienie komponentu, trasy, stanu, okablowania zdarzeń, renderingu, brak błędów runtime.
    *   **Visual Validation (301):** Jeśli zadanie zmienia wizualizację: renderuj, inspekcja, porównanie ze specyfikacją. Nie waliduj tylko źródła TS.
    *   **Event Validation (302):** Jeśli zadanie zależy od zdarzenia: wyprodukuj zdarzenie, obserwuj, weryfikuj payload. Dokumentacja jest niewystarczająca, gdy liczy się zachowanie runtime.
    *   **Regression Check (303):** Po naprawie: ponownie uruchom oryginalną walidację + celowane testy regresji. Nie tylko weryfikuj, że naprawa się kompiluje.

*   **Zakończenie i Pamięć (304–311):**
    *   **Final Validation Gate (304):** Zadanie staje się FINAL tylko gdy: wymagania PASS, audyt API PASS, audyt architektury PASS, testy PASS, walidacja runtime PASS (jeśli dotyczy), brak krytycznych nierozwiązanych twierdzeń.
    *   **Final Artifact (305):** Tworzenie `FINAL-REPORT` zawierającego: zadanie, wymagania, implementację, testy, decyzje architektoniczne, znane ograniczenia, nierozwiązane elementy, pochodzenie modelu, dowody weryfikacji.
    *   **Memory Commit (306):** Tylko po FINAL-REPORT: ekstrakcja trwałej wiedzy (decyzje architektoniczne, odkryte API, konfiguracja, zależności, znane ograniczenia).
    *   **Memory Should Not Store (307):** Nie przechowuj trwale: tymczasowych spekulacji, nieudanych propozycji modeli, niezweryfikowanych założeń, szkiców pośrednich (chyba że przydatne dla historii audytu).
    *   **Knowledge Promotion (308):** Maszyna stanów: RAW → EXTRACTED → VERIFIED → PROMOTED → INDEXED. Tylko VERIFIED może stać się trwałą wiedzą architektoniczną.
    *   **Versioning (309):** Jeśli stara pamięć mówi "EventBus wspiera X", a nowe dowody "EventBus wspiera X + Y", utwórz nową wersję. Nie nadpisuj historii cicho.
    *   **Conflict (310):** Jeśli dowody sprzeczne z pamięcią: utwórz konflikt (status: OPEN). Rozwiąż z dowodami źródłowymi/runtime.
    *   **Final Memory Commit (311):** Przykład struktury wiedzy:
        ```yaml
        knowledge:
          id: ARCH-EVENTBUS-004
          statement: "NERU uses the existing EventBus implementation."
          confidence: 1.0
          provenance:
            - src/core/EventBus.ts
            - tests/EventBus.test.ts
          verified_at:
          verified_by:
            - typecheck
            - test
          status: ACTIVE
        ```

*   **Jakość i Błędy (312–316):**
    *   **Quality Score (312):**
        *   Q = 0.30 * requirement coverage + 0.20 * evidence correctness + 0.15 * implementation correctness + 0.15 * tests + 0.10 * architecture consistency + 0.10 * runtime validation.
        *   Wagi konfigurowalne. Dla czystych zadań architektonicznych runtime może mieć niższą wagę.
    *   **Hard Fail Conditions (313):** Wymuszają odrzucenie:
        *   Użycie nieistniejącego API jako wymaganej zależności.
        *   Pominięcie obowiązkowego wymagania.
        *   Błąd kompilacji.
        *   Nieudany obowiązkowy test.
        *   Architektura sprzeczna z zweryfikowaną strukturą repozytorium.
        *   Nieuzasadnione założenie krytyczne dla bezpieczeństwa.
        *   Destruktywna zmiana bez autoryzacji.
    *   **Soft Fail Conditions (314):** Wymagają naprawy, ale niekoniecznie odrzucenia:
        *   Niespójność nazewnictwa.
        *   Niekompletna dokumentacja.
        *   Drobne pominięcia.
        *   Nieoptymalna implementacja.
        *   Redundantna abstrakcja.
    *   **Quality Report (315):** Przykład raportu PASS (10/10 req, 18/18 API, 42/42 tests, 0 unsupported claims, 1 repair iteration).
    *   **Failure Report (316):** Przykład raportu REPAIR REQUIRED (8/10 req, 3 unsupported APIs, 2 missing modules, 31/37 tests, Runtime NOT RUN).

*   **Adaptacja i Pipeline (317–323):**
    *   **Model-Specific Feedback (317):** Jeśli model halucynuje, nie dodawaj "bądź dokładniejszy". Generuj konkretne ograniczenie: "Wszystkie nazwy zdarzeń muszą być pobrane z src/... przed użyciem."
    *   **Prompt Adaptation (318):** Benchmark może utrzymywać `model_constraints` (np. dla qwen3.8-27b: require_api_factcheck: true, require_typecheck: true).
    *   **Task-Specific Guardrails (319):**
        *   Architecture: API inventory, node matrix, dependency matrix.
        *   Coding: diff, typecheck, tests.
        *   Refactoring: dependency graph, regression tests.
        *   UI: component inventory, route inventory, runtime validation.
    *   **Anti-Hallucination Pipeline (320):** MODEL → CLAIM EXTRACTION → EVIDENCE SEARCH → CLAIM CLASSIFICATION → OMISSION CHECK → CONTRADICTION CHECK → JUDGE → REPAIR → TOOLS → FINAL VALIDATION.
    *   **The Model is Not the Judge of Reality (321):** Model proponuje. Narzędzia weryfikują. Judge porównuje. Runtime decyduje.
    *   **Final Execution Principle (322):** Hermes optymalizuje VERIFIED QUALITY, nie RAW TOKEN OUTPUT. Model 120 tok/s z 10% halucynacji jest gorszy niż model 50 tok/s z 2% halucynacji.
    *   **Final Success Condition (323):** Zadanie jest kompletne tylko gdy "Repozytorium dowodzi wyniku", a nie "Model wyprodukował przekonującą odpowiedź".

**Plan Rozbudowy (Parts 6–17)**

*   **PART 6 — Skill Runtime / State Machine:**
    *   Lifecycle: INTAKE → DECOMPOSE → RESEARCH → CANDIDATES → VERIFY → JUDGE → IMPLEMENT → TEST → REPAIR → FINAL.
    *   Stany, przejścia, timeouty, cancellation, resume po restarcie, recovery po awarii.
*   **PART 7 — Prompt Engine:**
    *   Osobne prompty dla: Researcher, Architect, Coder, Reviewer, Fact Checker, Judge, Repairer, Synthesizer.
    *   Dynamiczne budowanie kontekstu, ograniczenie halucynacji API, wymaganie cytowania plików/linii, mechanizm "UNKNOWN zamiast zgadywania".
*   **PART 8 — Agent Contracts:**
    *   RESEARCHER: może czytać, nie może modyfikować kodu.
    *   ARCHITECT: może projektować, nie może twierdzić o istnieniu API bez dowodu.
    *   CODER: może tworzyć patch, nie może zatwierdzać własnego patcha.
    *   JUDGE: może ACCEPT/REJECT/REPAIR, nie może samodzielnie implementować.
*   **PART 9 — Context / RAG / Obsidian Integration:**
    *   Przepływ: Obsidian → Memory OS → Retriever → Evidence Pack → Hermes → Model.
    *   Definicja: co trafia do kontekstu, chunking, ranking, deduplikacja, priorytet dokumentacji, wersjonowanie.
*   **PART 10 — Code Agent / Patch Engine:**
    *   Mechanizm: PLAN → FILE DISCOVERY → READ → PATCH → DIFF → TYPECHECK → TEST → REVIEW → APPLY.
    *   Zasady: atomic patches, rollback, git checkpoints, ograniczenie zakresu, wykrywanie niezamierzonych zmian.
*   **PART 11 — Distributed Protocol:**
    *   Komunikacja między workerami (3090, M4, M2).
    *   Definicja: WorkerRegistration, JobRequest, JobAccepted, JobProgress, JobResult, ArtifactCreated, WorkerHeartbeat, WorkerOffline, JobFailed, JobRetry + JSON schema.
*   **PART 12 — Model Adapter Layer:**
    *   Wspólny interfejs `ModelAdapter` dla: Qwen, Claude, DeepSeek, GLM, Mistral, Llama.
    *   Obsługa: Ollama, llama.cpp, vLLM, OpenAI-compatible API, lokalnych modeli, cloud fallback.
*   **PART 13 — Benchmark / Model Selection:**
    *   Hermes decyduje routing (np. Qwen 27B → architecture, Model X → coding).
    *   Mierzenie: correctness, hallucination, omission, compile success, test success, latency, tok/s, VRAM, RAM, repair count.
*   **PART 14 — Security / Permissions:**
    *   Sandbox, dozwolone komendy, filesystem permissions, secrets, network permissions, destructive commands, approval gates.
*   **PART 15 — Observability/UI Contract:**
    *   Dane dla UI: WORKER, MODEL, JOB, AGENT, QUEUE, TOKEN RATE, VRAM, RAM, NETWORK, CURRENT STEP, EVIDENCE, DISAGREEMENT, JUDGE, REPAIR.
    *   UI pokazuje rzeczywisty stan, nie wymyślone eventy.
*   **PART 16 — Persistence / Resume:**
    *   Po restarcie (np. przy JOB 17/32): wiedza o wykonanym, ważnym, istniejących artefaktach, jobach do wznowienia/powtórzenia. Bez ponownego wykonywania całego MoA.
*   **PART 17 — End-to-End Reference Implementation:**
    *   Scenariusz: "Dodaj nową zakładkę observability do NERU."
    *   Przepływ: USER → Hermes → Requirements → Research → 3 Architect Agents → Fact Check → Judge → Implementation → TypeScript → Tests → UI validation → Repair → Final → Memory.
    *   Konkretny JSON, joby, artefakty.

**Szczegóły Part 6 (Sekcje 325–328)**

*   **325. PURPOSE:**
    *   Definiuje wykonalny lifecycle zadania Hermes-MOA.
    *   Konwertuje koncepcyjną architekturę MoA w deterministyczną maszynę stanów.
    *   Runtime musi zawsze wiedzieć: CO się dzieje, DLACZEGO, KTÓRY agent jest odpowiedzialny, KTÓRY artefakt jest produkowany, KTÓRE dowody są wymagane, JAKI warunek pozwala na następny stan, CO się dzieje przy awarii.
    *   Żaden agent nie może dowolnie pominąć stanów lifecycle.
*   **326. ROOT TASK LIFECYCLE:**
    *   Każde zadanie zaczyna się od INTAKE.
    *   Przejścia: INTAKE → CLASSIFY → DECOMPOSE → CONTEXT_BUILD → RESEARCH → CANDIDATE_GENERATION → FACT_CHECK → JUDGE → PLAN → IMPLEMENT → VALIDATE → REPAIR → FINAL_REVIEW → COMMIT → MEMORY_UPDATE → COMPLETE.
    *   Nie każde zadanie wymaga każdego stanu.
*   **327. TERMINAL STATES:**
    *   Stany terminalne: COMPLETE, FAILED, BLOCKED, CANCELLED.
    *   Zadanie terminalne nigdy nie może cicho wrócić do RUNNING.
    *   Aby wznowić nieudane zadanie: utwórz przejście RESUME lub jawnie otwórz zadanie ponownie.
*   **328. TASK STATE:** (Sekcja urwana w źródle, ale tytuł wskazuje na definicję stanów zadania).

**505. ROLE SEPARATION**
Agents must have narrow responsibilities. No agent should perform all roles simultaneously for MOA >= 2.

**507. ANTI-HALLUCINATION CONTRACT**
The following rule is mandatory: IF a concrete identifier is not present in supplied evidence, the model MUST NOT present it as existing. Concrete identifiers include: function names, class names, event names, interfaces, files, directories, environment variables, configuration keys, API endpoints, database tables, component names, hooks, routes, commands.

**509. FACT STATUS**
Every claim concerning repository reality should contain a status (VERIFIED, INFERRED, PROPOSED, UNKNOWN, CONTRADICTED) and evidence.

**512. SOURCE PRIORITY**
When sources disagree: 1. actual runtime, 2. tests, 3. source code, 4. configuration, 5. current documentation, 6. versioned architecture docs, 7. memory, 8. model knowledge. Model knowledge is lowest priority for repository-specific facts.

**516. COVERAGE RULE**
The model must explicitly map: requirement -> proposed action -> affected file -> verification.

**518. JSON-FIRST**
Whenever Hermes consumes the output programmatically: require structured output. Do not parse free-form prose where a schema can be used.

**519. SCHEMA VALIDATION**
The runtime validates: JSON syntax, required fields, enum values, array types, object structure before passing output to another agent. Invalid output results in OUTPUT_INVALID, then repair/retry.

**521. ROLE: RESEARCHER**
Researcher objective: discover evidence. NOT: solve the entire task.

**524. ROLE: API_VERIFIER**
Objective: verify concrete identifiers. Input: candidate claims. Output: verified, not_found, contradicted, ambiguous.

**526. ROLE: ARCHITECT**
Objective: produce architecture options. Architect receives: requirements, evidence, research, constraints. Architect does NOT receive another candidate's architecture when independent generation is required.

**529. ROLE: CANDIDATE_GENERATOR**
Candidate generation must be independent. Candidate A must not see Candidate B until Judge stage. This prevents convergence on the first model's mistake.

**531. ROLE: JUDGE**
Judge receives: all candidates, fact-check results, requirements, constraints. Judge must compare.

**534. IMPORTANT JUDGE RULE**
A candidate with 95% architectural quality but 3 fabricated APIs must NOT automatically beat 85% quality with completely verified APIs. Evidence correctness is a hard constraint.

**535. ROLE: PLANNER**
Planner converts approved architecture into implementation steps. Rules: no new architecture, no scope expansion, no invented APIs. If implementation reveals architectural conflict: return to ARCHITECT. Do not silently redesign during coding.

**536. ROLE: CODER**
Coder receives: approved architecture, plan, source, evidence, tests. Coder must: inspect actual files, produce minimal patch, preserve unrelated code, add tests where required, report uncertainty.

**539. ROLE: TEST_ANALYST**
Test Analyst determines: what must be tested, which existing tests apply, what new tests are needed, whether test failures represent code or environment problems. It does not modify code.

**540. ROLE: REPAIRER**
Repairer receives: failure, root-cause analysis, current diff, relevant source, requirements. Repairer must modify only the smallest necessary scope.

**542. ROLE: REVIEWER**
Reviewer must be independent from the coder. Reviewer sees: requirements, architecture, final diff, test results. Reviewer does NOT receive: coder's internal reasoning unless required for audit. This prevents persuasion by the author.

**544. ROLE: MEMORY_CURATOR**
Memory Curator receives: final result, verified facts, architectural decisions, rejected alternatives, known limitations. It must NOT store: speculation, temporary debugging guesses, model opinions, unverified API names.

**546. ROLE: SYNTHESIZER**
Synthesizer produces the user-facing result. It receives: final artifacts, not: raw candidate debates unless requested.

**547. SYNTHESIZER RULE**
The final response must distinguish: IMPLEMENTED, VERIFIED, NOT VERIFIED, REMAINING. Do not say "done" if validation did not pass.

**551. ANTI-CONTAMINATION**
Candidate prompts must not include: previous candidate architecture, previous candidate conclusions, Judge score until the appropriate stage.

**552. CONTEXT HASH**
Every prompt stores: contextHash. This allows Hermes to determine: which evidence the model actually received.

**553. PROMPT VERSION**
Every prompt stores: promptVersion (e.g., architecture-v3.2). This allows benchmark comparison.

**554. PROMPT IMMUTABILITY**
Once a job begins: prompt = immutable. If context changes: create new prompt version. Do not mutate a prompt while generation is running.

**555. MODEL-SPECIFIC ADAPTATION**
Prompt semantics remain constant. Formatting may change per backend (Qwen: structured JSON, Hermes: structured XML/JSON, llama.cpp: JSON schema if supported). The semantic contract must remain identical.

**557. WHY LOW TEMPERATURE FOR VERIFICATION**
Verification tasks should optimize: consistency rather than: creativity. Therefore: API_VERIFIER, JUDGE, REVIEWER should generally use low stochasticity.

**558. WHY HIGHER DIVERSITY FOR CANDIDATES**
Candidate generation intentionally benefits from: architectural diversity. Therefore independent candidates may use higher temperature or different decoding configurations.

**561. DISAGREEMENT PRIORITY**
The source of truth resolves disagreement. Preferred: runtime, tests, source, documentation, model.

**562. SELF-CONSISTENCY IS NOT EVIDENCE**
Five agents saying "security.violation exists" does NOT make it true. Only repository evidence can verify it.

**568. ARCHITECTURE CLAIM TYPES**
Every architecture statement must be classified: EXISTING, PROPOSED, REQUIRED, OPTIONAL, UNKNOWN. This prevents prose from blurring reality and design.

**570. PROMPT VALIDATION**
Before sending: validatePrompt(prompt). Checks: role present, task present, requirements present, constraints present, evidence present, unknowns present, output schema present, validation rules present.

**571. EMPTY EVIDENCE**
If repository-specific task has: evidence = [], the model receives: "NO VERIFIED REPOSITORY EVIDENCE AVAILABLE." It must not infer that absence means existence.

**573. TOOL RESULT AS EVIDENCE**
If an agent executes a command (e.g., grep) and receives a result, the result becomes an EvidenceRef. It can then be cited by the agent.

**574. TOOL OUTPUT TRUST**
Tool output is not automatically correct. The runtime records: tool, command, arguments, timestamp, result, exit code.

**578. CLAIM GATING**
Unsupported claims may be: ignored, repaired, rejected depending on severity. Critical unsupported claims block progression.

**582. DOCUMENTATION AS DATA**
Documentation may contain: obsolete architecture, examples, speculative designs. Therefore: documentation ≠ truth automatically. Current source/runtime evidence takes precedence.

**583. PROMPT INJECTION FROM MEMORY**
Memory may also contain stale or malicious instructions. Memory is: evidence, not: authority unless verified.

**584. OUTPUT SANITIZATION**
Before passing output downstream: remove: hidden chain-of-thought, irrelevant meta commentary, tool secrets, credentials, environment secrets. Keep: conclusions, evidence, decisions, artifacts, structured reasoning summary.

**585. NO CHAIN-OF-THOUGHT DEPENDENCY**
Hermes must never require private model reasoning. Agents communicate through: conclusions, claims, evidence, artifacts, decisions. This makes the system portable across models.

**594. CONTEXT REUSE**
For long coding sessions: Hermes should preserve the stable context hash. If unchanged: reuse cached context.

**599. MOA QUALITY PRINCIPLE**
The goal is NOT: "find the smartest model." The goal is: "construct the strongest verified workflow from available models."

**601. CRITICAL HERMES RULE**
Never optimize prompt brevity at the expense of verification. A shorter prompt that allows: invented API is worse than a longer prompt that prevents it.

**602. SECOND CRITICAL RULE**
Never optimize model speed by removing: requirements, constraints, evidence, unknowns. These are the components most responsible for correctness.

**603. THIRD CRITICAL RULE**
The Prompt Engine must remain model-agnostic. It must work with: Qwen, Hermes, Llama, DeepSeek, GLM, Mistral, cloud models, future models without changing the workflow semantics.

**700. PURPOSE (PART 8)**
PART 8 defines executive agent contracts. An agent is not a "general chatbot". Each agent has: defined role, scope of responsibility, inputs, outputs, tools, permissions, stop conditions, handoff conditions. Most important rule: AGENT CANNOT EXPAND ITS OWN AUTHORITY. Agent cannot change its role independently.