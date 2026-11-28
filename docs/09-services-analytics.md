# 09. Сервисы и аналитика

Все нативные возможности подключаются через Capacitor-плагины и спрятаны за интерфейсами в `src/services/`. Названия плагинов ниже являются кандидатами: перед установкой проверить, что плагин поддерживает текущую версию Capacitor, Swift Package Manager и обновлялся в последние 6 месяцев. Если нет, выбрать аналог и записать в журнал решений (`_archive/08-tech-journal.md`).

## 1. Плагины

| Задача | Кандидат | Этап |
|---|---|---|
| Хранилище | `@capacitor/preferences` 8.0.1 (поставлен) | M7 |
| Вибрация | `@capacitor/haptics` 8.0.2 (поставлен) | M7 |
| Беззвучный режим | плагин не нужен: звуковая сессия iOS `ambient` (нативно в `AppDelegate` и `navigator.audioSession` страницы) сама молчит при выключенном звуке; `services/silent-mode/` в приложении — та же заглушка «никогда не беззвучно» (журнал `08`, 2026-11-19) | M7 |
| Жизненный цикл приложения, кнопка «назад» Android | `@capacitor/app` 8.1.2 (поставлен; `services/app-shell/`) | M7 |
| Внешние ссылки (страницы сайта из настроек) | без плагина: `AppShellService.openExternal`; в приложении переход на внешний адрес, его перехватывает оболочка Capacitor и отдаёт системе (iOS `UIApplication.open`, Android `Intent.ACTION_VIEW`), в браузере — новая вкладка | M7 (2026-11-20) |
| Заставка, системные панели | `@capacitor/splash-screen` 8.0.2 (поставлен); строка состояния — `SystemBars` из ядра Capacitor 8 вместо `@capacitor/status-bar`; цвет значков следует за экраном (`AppShellService.setBarIcons`, `_archive/08-tech-journal.md`, 2026-11-20) | M7 |
| Локальные уведомления | `@capacitor/local-notifications` 8.3.1 (поставлен; `SCHEDULE_EXACT_ALARM` убран из манифеста) | M8 |
| Поделиться | `@capacitor/share` + `@capacitor/filesystem` | M8 |
| Реклама | `@capacitor-community/admob` 8.2.1 (поставлен; не новее: с 8.3 лишняя зависимость, журнал `08`) | M8 |
| Покупки | `@revenuecat/purchases-capacitor` 14.1.2 (поставлен) | M8 |
| Аналитика и сбои | `@capacitor-firebase/analytics`, `@capacitor-firebase/crashlytics` 8.6.0 (поставлены; работают, только если в проекте есть файл настроек Firebase) | M8 |
| Запрос отслеживания (iOS) и форма согласия UMP | входят в плагин AdMob (`requestTrackingAuthorization`, `requestConsentInfo`, `showConsentForm`, `showPrivacyOptionsForm`) | M8 |
| Системная просьба оценить игру | `@capacitor-community/in-app-review` 8.0.0 (поставлен, одобрен владельцем 2026-11-20; StoreKit и Play In-App Review) | M8 |
| Таблицы рекордов и достижения (iOS) | свой плагин проекта `TippyGames` на системном GameKit, без npm-зависимостей (решение владельца, раздел 13); Android — этап 1.1-A | 1.1 |
| Облачное сохранение (iOS) | тот же плагин `TippyGames`, системное хранилище iCloud «ключ-значение» (`NSUbiquitousKeyValueStore`), без npm-зависимостей (раздел 14); Android — этап 1.1-A | 1.1 |

## 2. Хранилище

```ts
export interface StorageService {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}
```

Реализация приложений (M7): `services/storage/native.ts` на `@capacitor/preferences` (UserDefaults на iOS, SharedPreferences на Android). Те же строки под теми же ключами, что в браузере (формат сохранения не меняется, тест `native.test.ts`); сохранение переживает выгрузку приложения из памяти и пишется сразу при уходе приложения в фон (`game/app/native-shell.ts`). Ошибки плагина не прячутся: чтение со сбоем даёт `read_failed`, запись со сбоем повторяется (`08`, раздел 5).

Реализация для браузера: `services/storage/web.ts` на `localStorage`; любое обращение обёрнуто в `try/catch`, при сбое (приватный режим, заблокированные данные сайта, переполнение) значения живут в памяти страницы, исключений нет. Ключи: `save`, `save_backup`, `save_corrupt_*`, `save_replaced_*` (сохранение, проигравшее выбор облака), `run_draft` (черновик забега на время фона). Формат и правила в `08-architecture.md`, раздел 5. Облачное сохранение есть только на iOS (iCloud, раздел 14); на Android и без iCloud при удалении приложения прогресс теряется, об этом честно сказано в окне сброса прогресса (`07-ui-screens.md`, раздел 13). Разовые покупки восстанавливаются через стор.

## 3. Реклама

```ts
export type RewardedPlacement =
  | 'continue' | 'double_coins' | 'gift_double' | 'daily_attempt' | 'streak_restore' | 'shop_coins'
  | 'checkpoint_start';

/** Why no rewarded ad can be shown: no network; the next ad is loading right now; no ad for any other reason. */
export type RewardedUnavailableReason = 'offline' | 'loading' | 'no_fill';

export interface AdsService {
  init(): Promise<void>;                       // after consent
  isRewardedReady(): boolean;
  /** null while an ad is ready or another one shows; otherwise why not. Ad buttons poll it while they show. */
  rewardedUnavailableReason(): RewardedUnavailableReason | null;
  showRewarded(p: RewardedPlacement): Promise<'rewarded' | 'dismissed' | 'unavailable'>;
  /** Starts the loading again when no ad is ready and none is loading (failed counter reset); does nothing otherwise. */
  wake(): void;
  showInterstitial(): Promise<boolean>;        // only shows; the rules are decided by the caller (core/economy/video-policy.ts)
  setRemoveAds(v: boolean): void;
}
```

- **Причина недоступности** (решение владельца). `rewardedUnavailableReason()` возвращает `null`, пока реклама готова (`isRewardedReady()` истинно) или занята показом другой (это не недоступность: кнопка тогда пишет «Реклама недоступна», а в аналитике `reason` не пишется), иначе причину. `'offline'` — только когда устройство само сообщает, что сети нет (`navigator.onLine === false` в WebView; новых плагинов не нужно); эта причина важнее остальных. `'loading'` — пока идёт сам запрос загрузки следующего ролика (у нативного сервиса флаг `loading` слота), но не дольше `AD_LOAD.loadingCaptionMaxMs` (10 с, `data/economy/rewarded-video.ts`): запрос дольше этого наружу отдаётся как `'no_fill'`, хотя продолжается; во время пауз между повторами (`AD_LOAD.retryDelaysMs`) запроса нет, и причина `'no_fill'`. Кнопка в этом состоянии пишет «Загрузка…» (`07-ui-screens.md`, общие правила интерфейса). Всё остальное — `'no_fill'`: реклама не загрузилась, сеть рекламы не ответила, домены рекламы закрыты блокировщиком (при DNS-блокировщике сеть у устройства есть, поэтому кнопка честно пишет «Реклама недоступна», как требует критерий M8). Ответ `showRewarded`: `'unavailable'` без причины, причину вызывающий читает отдельно. Подпись кнопки по причине делает одна функция (`07-ui-screens.md`, общие правила интерфейса).
- После инициализации заранее загружается одна реклама за награду и одна межстраничная; после показа сразу загружается следующая.
- Правила показа межстраничной рекламы описаны в `05-economy-monetization.md`; решение принимает чистая функция `core/economy/video-policy.ts` (`canShowInterstitial`, покрыта тестами), а сервис `showInterstitial()` правил не знает и только показывает рекламу (`true`, если показал). Вызывает его единственное место, `game/economy/interstitial-flow.ts`.
- На время показа рекламы музыка и звуки приостанавливаются, игра на паузе. У `AudioService.suspend(reason)` / `resume(reason)` причина `'app'` (сворачивание) или `'ad'` (реклама); звук возвращается, только когда не держится ни одна причина.
- Браузерная заглушка: `services/rewarded-video/web.ts` (серый DOM-экран на 2 секунды, затем `'rewarded'`; межстраничная показывает такой же экран на 2 секунды со своей подписью и отвечает `true`, в режимах недоступности ничего не показывает и отвечает `false`). Режимы `reward`, `dismissed`, `offline`, `no_fill` и `loading` переключаются по кругу кнопкой «ads: …» в панели отладки (`?debug=1`) через `adsDev` (интерфейс `AdsDevControl`, не входит в `Services`); в режимах `no_fill` и `offline` `isRewardedReady()` ложно, `showRewarded` отвечает `'unavailable'`, а `rewardedUnavailableReason()` — `'no_fill'` или `'offline'` соответственно. В режиме `loading` заглушка «грузит» ролик `STUB_ADS.loadingMs` (5 с) при входе в режим и после каждого показа: в это время причина `'loading'`, потом реклама готова, как в `reward`. Настоящее состояние сети браузера заглушка не читает: обе причины проверяются только переключателем. Нативная реализация: `services/rewarded-video/native.ts` (см. ниже). **Сборка для игроков** (не dev-сервер и не внутренняя, `DEBUG_TOOLS` ложно) до M8 не показывает тестовую рекламу: заглушка стоит в режиме `no_fill`, кнопки рекламы пишут «Реклама недоступна», межстраничной нет (решение 2026-11-20, сборка закрытого теста Google Play).
- **Нативная реализация (M8)**: `services/rewarded-video/native.ts` на `@capacitor-community/admob` (плагин спрятан за малым интерфейсом `AdsPlugin`, `plugin.ts`, поэтому есть тесты на подменном плагине). Выбирается в `services/index.ts` только в приложении; в браузере остаётся `WebAds`. До `init()` (согласие ещё не пройдено, до первого завершённого забега) всё недоступно: `isRewardedReady()` ложно, причина `'no_fill'`. `init()` запускает SDK и загружает одну награждаемую и одну межстраничную рекламу; после каждого показа сразу грузится следующая (пока идёт её запрос, причина `'loading'`, см. выше). Показ завершается только когда реклама закрыта (событие закрытия), так что звук (`rewarded.ts`, `interstitial-flow.ts`) возвращается вовремя: `'rewarded'` только по событию награды, `'dismissed'` при закрытии без награды, `'unavailable'` при сбое показа или когда реклама не загружена. Неудачная загрузка повторяется с растущими паузами `AD_LOAD.retryDelaysMs` (5, 15, 45, 120 с), потом ждёт, пока реклама понадобится; плотного цикла нет. Ждущую загрузку будит `wake()`: если ролика нет и загрузка не идёт, счётчик неудач обнуляется, ждущий повтор отменяется и запрос идёт сразу (параллельных загрузок не бывает; готовый или грузящийся ролик `wake()` не трогает). `wake()` зовут: просьба показать недоступную рекламу, возвращение приложения на передний план (`services.appShell.onActiveChange(true)`) и событие `online` страницы (`game/app/video-wake.ts`, подключается в `main.ts`), начало забега (окно продолжения в конце ему нужно) и каждый экран с кнопкой рекламы за награду (при подписке кнопки на состояние сервиса, `watchAdState`). Заглушка браузера `wake()` ничего не делает. `showInterstitial()` при `setRemoveAds(true)` не показывает ничего, награждаемая остаётся. Любая ошибка плагина (заблокированные домены рекламы) превращается в `unavailable` / `false`, необработанных отказов нет. Если SDK не запустился или не удалось подписаться на его события (показ тогда не мог бы завершиться), реклама целиком недоступна: загрузок нет, показ отвечает `'unavailable'` / `false`. Страховка: если вызов показа вернулся, а событие закрытия не пришло за `AD_LOAD.showSafetyMs` (120 с, таймер идёт только после возврата вызова показа), показ завершается как закрытый (`'dismissed'`, а при уже пришедшей награде `'rewarded'`; межстраничная отвечает `true`), поэтому поток продолжения и звук не зависают.
- **Рекламные блоки** (`services/rewarded-video/ad-units.ts`, `pickAdUnits`): сервер разработки и внутренняя сборка (`DEBUG_TOOLS`) всегда берут публичные тестовые блоки Google (`SAMPLE_AD_UNITS` в `data/economy/rewarded-video.ts`; это не секреты, их разрешает страж ключей), сборка для магазина берёт `VITE_ADMOB_REWARDED_ID_IOS` / `_INTERSTITIAL_ID_IOS` / `_ANDROID` из `.env`; блок без идентификатора означает «рекламы этого вида нет» (`'no_fill'`), тестовая реклама в магазинной сборке не показывается никогда. Флаги `initializeForTesting` и `isTesting` не нужны: тестовые блоки сами отдают тестовую рекламу.
- Аналитика: у `ad_rewarded_result` с `result` = `unavailable` есть параметр `reason` (`offline` / `no_fill`), если сервис назвал причину; иначе (занят показом, сбой вызова) параметра нет. Причина читается сразу после неудачного показа, когда сервис уже грузит следующий ролик, поэтому `'loading'` пишется как `no_fill` (`game/economy/rewarded.ts`): у события по-прежнему два значения.
- В разработке и во внутренних сборках используются **тестовые идентификаторы** рекламных блоков Google. Боевые идентификаторы берутся из `.env` только в релизной сборке. Нажимать на собственную боевую рекламу нельзя: это ведёт к блокировке аккаунта AdMob.
- Файл `app-ads.txt` разместить на сайте разработчика (тот же сайт, что с политикой конфиденциальности).

## 4. Согласия

Порядок после первого завершённого забега (не при запуске):

1. На iOS: собственное окно-пояснение, затем системный запрос App Tracking Transparency. Текст причины в `Info.plist` (`NSUserTrackingUsageDescription`): «Это позволит показывать более подходящую рекламу и поддерживать игру бесплатной».
2. Форма согласия Google UMP. Показывается только там, где требуется (ЕЭЗ, Великобритания, Швейцария).
3. Инициализация рекламы.

Почему запрос ATT идёт раньше формы UMP: если в AdMob (**Конфиденциальность и сообщения**, Privacy & messaging) опубликовано сообщение IDFA, форма UMP сама показывает пояснение Google и сразу за ним системный запрос ATT, пока статус ATT «не определён» (справка AdMob: https://support.google.com/admob/answer/10115027, https://support.google.com/admob/answer/10115331 — «If you don't want the iOS ATT alert to be triggered, unpublish the message»). Когда ATT спрошен первым, формы IDFA у UMP нет (она бывает только при статусе «не определён»), и UMP показывает только форму для ЕЭЗ. Сообщение IDFA в AdMob всё равно надо снять с публикации: пока оно опубликовано, UMP на iOS до ответа на ATT отвечает «согласие требуется» и вне ЕЭЗ, и аналитика первого забега на новой установке остаётся выключенной (раздел 6).

При отказе реклама остаётся, но неперсонализированная. В настройках есть пункт для повторного открытия формы согласия.

Реализация (M8): сервис `services/consent/` (`ConsentService`: `gather`, `privacyOptionsRequired`, `showPrivacyOptions`, `trackingStatus`, `requestTracking`; `native.ts` на плагине AdMob, `web.ts` заглушка), решения принимает `game/economy/consent-flow.ts`, подключено первым вопросом входа на Home (`game/ui/menu/consent/consent-ask.ts`, `HOME_ASKS`). За один вход на Home виден не больше одного вопроса: вопрос сообщает `done(shown)`, и если он не показал окно (тихое обновление согласия на каждом запуске), очередь идёт к следующему вопросу, а после первого показанного окна останавливается. Согласие считает показанным только своё окно-пояснение (форму Google сервис не сообщает). Правила:
- Поток идёт при входе на Home, когда `stats.runs >= 1`, один раз за запуск приложения. Первый запуск после первого забега и каждый следующий проходят те же шаги; окон нет, пока их не требует сам UMP: информация UMP обновляется молча при каждом запуске (так Google велит применять UMP), форма показывается только когда UMP сообщает `REQUIRED`.
- Окно-пояснение (`PopupWindow`, ключи `consent.*`, одна кнопка «Продолжить», без крестика) и системный запрос ATT идут только на iOS, только когда статус ATT `notDetermined` и `consent.attAsked` ложно; после запроса `gameState.noteAttAsked()` пишет `consent.attAsked`. На Android и в браузере вопроса нет.
- Обновление поверх старого сохранения (`stats.runs >= 1` уже есть): поток идёт на первом же входе на Home после запуска обновлённой игры, отдельного забега не ждёт. Если ответа на ATT ещё нет (сборки без согласий, до 0.1.0 (5)), сначала окно-пояснение, потом ATT, потом UMP. Если ATT уже отвечен (система хранит ответ, пока приложение не удалено; в сборках 0.1.0 (5) и (6) его мог задать сам UMP), окон нет, `consent.attAsked` остаётся ложным и ни на что не влияет: вопрос сверяется со статусом системы на каждом запуске.
- Сбой любого вызова (заблокированные домены, нет сети; запрос информации UMP ждёт не дольше `AD_LOAD.consentTimeoutMs`) не останавливает поток и ничего не бросает: реклама запускается всё равно (`AdsService.init()` последним шагом), неперсонализированная, если согласие или отслеживание отклонены (решает SDK).
- Пункт настроек «Настройки конфиденциальности» (`settings.privacyOptions`) виден, только когда UMP сообщил `privacyOptionsRequirementStatus = REQUIRED`; нажатие открывает `showPrivacyOptionsForm()`.
- Браузер: UMP не требуется, ATT нет. Для просмотра пояснения и пункта настроек в разработке и во внутренней сборке есть `?consent=1` (`WebConsent` в режиме «как на телефоне»: вопрос ATT открыт, параметры конфиденциальности предлагаются); нужен сохранённый забег (`stats.runs >= 1`, подсказка `tutorial` показана).
- Отладочной подмены региона UMP нет: форму в ЕС проверяют через VPN или отладочную геолокацию на устройстве с зарегистрированным тестовым идентификатором.

## 5. Покупки

```ts
export type PurchaseResult = 'purchased' | 'cancelled' | 'failed' | 'pending';  // значения для iap_result

export interface PurchaseReport {
  result: PurchaseResult;
  transactionIds?: string[];              // только при 'purchased': ид. транзакции из ответа покупки и ид., под которым её показывает список аккаунта (если другой)
  reason?: 'unavailable' | 'network';     // только при 'failed': стор недоступен / нет сети
}

export interface StoreTransaction { productId: string; transactionId: string; purchasedAt: number }  // epoch ms

export interface IapService {
  init(): Promise<void>;
  getProducts(): Promise<Array<{ id: string; priceString: string; title: string }>>;
  purchase(id: string): Promise<PurchaseReport>;
  restore(): Promise<string[]>;     // owned non-consumable ids
  ownedNonConsumables(): Promise<string[]>;
  completedTransactions(): Promise<StoreTransaction[]>;   // все завершённые разовые транзакции аккаунта стора (расходуемые тоже)
}
```

- Цены в интерфейсе всегда берутся из стора (`priceString`), а не из кода: они зависят от страны.
- Выдача товара происходит **только после подтверждённой покупки**. Расходуемые товары (ягоды) выдаются один раз на транзакцию; идентификаторы обработанных транзакций хранятся в сохранении (последние 50) для защиты от двойной выдачи.
- Состояние `pending` (например, «Попросить купить» в семейном доступе): показать сообщение «Покупка ожидает подтверждения», выдать товар при следующем запуске, когда транзакция завершится.
- Выдача на запуске (`syncPurchases()` в `game/economy/purchases.ts`, сначала выдача, потом сверка разовых покупок): берутся `completedTransactions()`; транзакцию, которой нет в `iap.processedTx`, выдают целиком, **если дата покупки не раньше `save.createdAt` и не старше `IAP_RULES.launchPayoutDays` (7) дней** (`unpaidTransactions` в `core/economy/purchase-tx.ts`). Так выдаётся одобренная «Попросить купить» и покупка, прерванная убийством приложения между ответом стора и выдачей, в том числе стартовый набор (с монетами и ягодами; уже имеющийся разовый товар `grantProduct` не выдаёт второй раз). Переустановка и сброс прогресса (`createdAt` = момент сброса) старое второй раз не платят, а окно в 7 дней не даёт повторно выдать транзакцию, вытесненную из списка из 50. Одна покупка может быть известна под двумя ид. (RevenueCat в списке аккаунта может показывать свой ид., а в ответе покупки — ид. стора): после покупки в `iap.processedTx` пишутся оба, а совпадение любого считает транзакцию выданной. Транзакция записывается тем же сохранением, что и выдача.
- Нативная реализация: `services/iap/native.ts` (RevenueCat, `@revenuecat/purchases-capacitor`), ключи `VITE_REVENUECAT_API_KEY_IOS` / `_ANDROID`. Без ключа (или если `configure` упал) сервис работает как «стор недоступен»: нет товаров, `purchase` даёт `failed` с причиной `unavailable`, `restore` бросает ошибку (кнопка покажет «Не удалось связаться со стором»), `ownedNonConsumables` и `completedTransactions` пусты. Заглушка в нативной сборке не подставляется никогда. Ошибки плагина: `PURCHASE_CANCELLED_ERROR` → `cancelled`, `PAYMENT_PENDING_ERROR` → `pending`, `NETWORK_ERROR` / `OFFLINE_CONNECTION_ERROR` → `failed` + `network` (сообщение «Магазин недоступен, попробуйте позже»), прочее → `failed`. Необработанных отказов нет.
- Восстановление (`restore`): только разовые товары. `remove_ads` включает флаг; `starter_pack` возвращает только флаг и существо, если его нет; монеты и ягоды набора не платятся повторно (они выданы один раз на устройстве покупки, `withPurchasesRestored` в `core/economy/shop.ts`).
- При каждом запуске `ownedNonConsumables()` сверяется с сохранением (`game/economy/purchases.ts`: ключи товаров попадают в `purchases.*`, затем `services.ads.setRemoveAds`). Старт игры ждёт эту проверку не дольше `BOOT.purchasesWaitMs` (2 с, `data/app/boot.ts`): на медленной сети она доходит в фоне и пишет итог в сохранение, когда придёт. Если такая поздняя проверка вернула разовый товар, которого в сохранении не было (на этом Apple ID или Google-аккаунте он уже куплен: «Без рекламы» включается, стартовый набор уходит из магазина, Кроха появляется без монет и ягод набора), магазин один раз говорит об этом надписью «Покупки восстановлены» (`takeLaunchRestored` в `game/economy/purchases.ts`): сразу, если он открыт, или при следующем открытии; во время рекламы магазин не перестраивается, и надпись появляется после неё. Кнопка «Восстановить покупки» сообщает свой итог и эту надпись снимает. Сверка у запуска, кнопки и возврата приложения на передний план одна (`reconcile` в `game/economy/purchases.ts`; входы `syncPurchases` и `restorePurchases`): сначала выдаётся оплаченное, но не выданное (`completedTransactions`: стартовый набор, ягоды; каждая транзакция один раз, повторная сверка ничего не добавляет), потом сверяется владение разовыми товарами (на запуске и при возврате `ownedNonConsumables`, у кнопки `restore`). Одновременно идёт одна сверка: вызов во время неё получает её итог. Возврат приложения запускает сверку через `appShell.onActiveChange(true)` (`game/app/purchases-resume.ts`; одобренная «Попросить купить» доходит без перезапуска); в браузере стора нет, и сверка там не повторяется. Итог кнопки: «Покупки восстановлены», если что-то выдано или стор назвал разовый товар; «Нечего восстанавливать», если нет ни того ни другого; «Не удалось связаться со стором», если `restore` не ответил и ничего не выдано. Другого пути убрать стартовый набор из магазина без покупки в коде нет (окно в 7 дней начинается только с показа набора на главном экране после 10-го забега).
- Идентификаторы товаров в репозитории не лежат: код знает товар по логическому ключу (`data/economy/shop.ts`: `remove_ads`, `starter_pack`, `berries_80` ... `berries_2800`), а ключ в ид. стора переводит `services/iap/product-ids.ts` по переменным `VITE_IAP_*` из `.env` (образец в `.env.example`; ид. в сторах с приставкой игры `tippy_`, `05-economy-monetization.md`, раздел 5). Товар без ид. в магазине показывается недоступным.
- Браузерная заглушка: `services/iap/web.ts` (DOM-окно «Купить (тест)?», купленные разовые товары хранит как стор, отдельно от сохранения). Цены в ней — данные заглушки (`data/economy/iap-stub.ts`), в игре цены всегда приходят из `getProducts()`. В сборке для игроков до M8 у заглушки нет товаров и ничего не числится купленным (`services/iap/stub-iap.ts`, `createStubIap`): окна «Купить (тест)?» нет, в магазине покупки показаны недоступными, строки «Без рекламы» в настройках нет, тестовая покупка внутренней сборки на том же телефоне не восстанавливается (решение 2026-11-20).
- RevenueCat бесплатен до определённого порога месячного дохода; условия проверить на их сайте перед подключением. Альтернатива без посредника: `@capgo/native-purchases` или аналогичный плагин StoreKit 2 / Play Billing.

## 6. Аналитика

Firebase Analytics. Идентификаторы пользователей и личные данные не отправляются. Имена событий и параметров в `snake_case`, не длиннее 40 символов.

```ts
export interface AnalyticsService {
  logEvent(name: string, params?: Record<string, string | number | boolean>): void;
  setUserProperty(name: string, value: string): void;
}
```

В браузере сервис: `services/telemetry/web.ts` печатает `[telemetry] имя {параметры}` через `console.info` в режиме разработки, в продакшен-сборке молчит; он зарегистрирован как `services.telemetry`. Внутри приложения `services/telemetry/native.ts` отправляет события в Firebase Analytics (`logEvent`, `setUserProperty`), но только когда в сборке есть файл настроек Firebase своей системы (`__FIREBASE_IOS__` / `__FIREBASE_ANDROID__`, `vite.config.ts`); без файла работает тихая браузерная заглушка и плагин Firebase не вызывается ни разу (его SDK не настроен). Плагины `@capacitor-firebase/analytics` и `crashlytics` берутся из JS по имени через `registerPlugin('FirebaseAnalytics')` и `registerPlugin('FirebaseCrashlytics')`, пакеты в JS не импортируются: их веб-часть требует SDK `firebase`, которого в игре нет.

Каждый вызов нативного сервиса «выстрелил и забыл»: отказ плагина, заблокированные домены Firebase, исключение мостика гасятся без следа (ни необработанного отказа, ни ошибки в игре). Перед отправкой имя и параметры проверяет чистая `services/telemetry/validate.ts`: `snake_case`, имя события и параметра до 40 символов, имя свойства пользователя до 24, значение параметра до 100, значение свойства до 36, не больше 25 параметров, без префиксов `firebase_`, `google_`, `ga_`. Неправильное событие отбрасывается (в разработке и во внутренней сборке с предупреждением), параметр с плохим именем отбрасывается, длинный текст обрезается, булево становится 1 или 0 (числа и строки Firebase понимает, булево нет). Лимиты лежат в `data/app/telemetry.ts`.

События, которые строит слой сохранения, отправляет `GameState` (`state/game-state.ts`, строители параметров с тестами в `state/events/state-events.ts`): так точка отправки одна на событие и их не обойти из сцены. В сервис события попадают только из забегов, которые пишутся в сохранение, как и `run_start`. Свойства пользователя считает `state/events/user-properties.ts` при каждой смене сохранения и при загрузке, отправляются только изменившиеся.

Отправляются (всё из таблицы ниже):

| Событие | Откуда |
|---|---|
| `tutorial_step` | `GameState.markHint`: каждая новая подсказка (`step` = ид. подсказки из `HINT_IDS`) |
| `tutorial_complete` | `recordRun`: самый первый забег в сохранении |
| `run_start` | сцена забега, `game/run/run-telemetry.ts`: только для забегов, которые пишутся в сохранение (не демо и не отладочные `?bot=`, `?start=`, `?team=`, `?level=`); `team` без пустых слотов, `run_index` = число законченных забегов + 1 |
| `checkpoint_offer`, `checkpoint_start`, `currency_spend` за старт | `game/run/checkpoint-start.ts` (`item` = `checkpoint_<высота>`, только за ягоды) |
| `run_end`, `new_record`, `level_up`, `creature_unlock` (`source` `record`/`level`), `mission_complete`, `daily_attempt`, `currency_earn` (`run`, `lap`) | `GameState.recordRun`; `duration_s` округлена до секунд, `abilities_used` из счётчиков забега |
| `continue_offer`, `continue_used` | `game/run/continue-flow.ts` (параметры: `game/run/continue-telemetry.ts`); `option` = `ad`, `berries` или `both` (что окно предлагает сейчас), `height` = высота башни в момент промаха |
| `creature_unlock` (`source` `shop_coins`/`shop_berries`/`streak`/`level`/`purchase`), `creature_upgrade`, `currency_spend` (`item` = `creature_<ид>`, `upgrade_<ид>`, `continue`, `berry_exchange`, `streak_restore`) | `buyCreature`, `upgradeCreature`, `spendBerries`, `exchangeBerries`, `restoreStreak` |
| `team_change` | `GameState.setTeam`, только если состав изменился |
| `mission_chest`, `streak_day`, `streak_lost`, `streak_restore` | `claimChest`, `claimStreak`, `declineStreak` (серия сброшена игроком; `count` = длина до сброса), `restoreStreak` |
| `gift_open` | окно подарка (`game/ui/menu/home/gift-window.ts`, `game/economy/economy-telemetry.ts`): при закрытии окна, `doubled` = удвоено ли рекламой |
| `ad_rewarded_show`, `ad_rewarded_result` | `showRewarded`, каждое место показа |
| `ad_interstitial_show` | `GameState.noteInterstitialShown` |
| `shop_open` | `ShopScene.create`: `source` = `home` (кнопка Дома) или `return` (возврат с экрана нового существа) |
| `map_open` | `openMapFromHome` (`game/ui/menu/climb-map/climb-map-window.ts`, событие в `climb-map-telemetry.ts`): касание плашки рекорда на Home |
| `journal_open` | `openJournalFromHome` (`game/ui/menu/journal/journal-window.ts`, событие в `journal-telemetry.ts`): касание плашки уровня на Home; возврат в журнал из окна мушек или окна сравнения события не шлёт, сами эти окна тоже |
| `iap_start`, `iap_result` | `buyProduct` (`game/economy/purchases.ts`): `product` = ключ товара (`remove_ads`…), не идентификатор магазина; `result` = `purchased`/`cancelled`/`failed`/`pending` |
| `currency_earn` | `GameState` при любом начислении от крупного источника: от 100 монет или от 1 ягоды (`TELEMETRY.earnMin`); не `debug` и не ягоды, подобранные в забеге (их сумма в `run_end`) |
| `notif_permission` | `ensureNotifPermission` в `game/app/notif-permission.ts`, на каждый ответ системного запроса |
| `settings_change` | `GameState.updateSettings`: по событию на каждый сдвинувшийся ключ (`music`, `sfx`, `haptics`, `reducedFx`, `lang`, `notif_gift`, `notif_streak`, `notif_daily`, `notif_comeback`); значение 1/0 или язык |

Согласие (решение владельца). Отдельного выключателя аналитики в настройках нет. В ЕЭЗ, Великобритании и Швейцарии сбор Firebase Analytics следует за ответом в форме Google UMP: согласие дано — сбор включён, отказ — выключен; в остальных странах сбор включён. Crashlytics от этого не зависит и работает везде. Пользовательский идентификатор не задаётся (`setUserId` не вызывается нигде), сигналы персонализации рекламы игра Analytics не передаёт. Данные только об использовании, без личных данных (раздел 10).

Как это сделано:
- В приложении сбор Analytics при запуске выключен (`FIREBASE_ANALYTICS_COLLECTION_ENABLED` = NO в `Info.plist`, `firebase_analytics_collection_enabled` = false в манифесте Android), его включает или выключает игра вызовом `setEnabled` плагина, когда решение известно. Пока решения нет, события и свойства игры ждут в памяти (`GatedAnalytics`, `services/telemetry/gated.ts`, не больше `TELEMETRY.pendingEvents` событий, лишние старые отбрасываются): при «включено» они уходят, при «выключено» пропадают.
- Решение принимает чистая функция `analyticsDecision` (`services/telemetry/consent-gate.ts`) по двум сигналам. (1) Строки IAB TCF, которые UMP сам пишет на устройство после ответа в форме (`IABTCF_gdprApplies`, `IABTCF_PurposeConsents`; читает их метод `consentSignals` своего плагина `TippyDevice`): действует GDPR и дано согласие на цель 1 TCF («хранить и читать данные на устройстве», без неё Analytics не может хранить свой идентификатор) — включено; действует GDPR и согласия на цель 1 нет — выключено; GDPR не действует — включено. (2) Пока строк нет (форма ещё не показывалась, она приходит после первого забега), решает тихое обновление информации UMP при запуске (окон нет): «согласие не требуется» — включено; «требуется» — выключено до ответа в форме; нет сети — решения нет, события ждут.
- Решение пересматривается при каждом запуске, после формы согласия (после первого забега) и после закрытия формы «Настройки конфиденциальности» в настройках (игрок может передумать в любую сторону).
- В браузере: консоль в разработке, ничего не отправляется.

### Отладка событий

В отладочной сборке (dev и внутренняя) все события пишутся в журнал `services/telemetry/event-log.ts` (последние 100 строк), отладочное меню показывает 25 последних и копирует их. Предупреждения проверки имён идут в тот же журнал со знаком `!`. Как смотреть события в Firebase на телефоне: `11a-device-build.md`, раздел 6.

### События

| Событие | Параметры | Когда |
|---|---|---|
| `tutorial_step` | `step` | Каждый шаг обучения |
| `tutorial_complete` | `height` | Конец первого забега |
| `run_start` | `mode`, `team` (ид. через запятую), `run_index`, `start_height` (0 или контрольная точка) | Начало забега |
| `checkpoint_offer` | `max_height` | Открыто окно выбора старта |
| `checkpoint_start` | `height`, `method` (`ad`/`berries`), `price` | Начат забег с контрольной точки |
| `run_end` | `mode`, `height`, `score`, `duration_s`, `perfects`, `best_combo`, `coins`, `abilities_used`, `continues`, `zone`, `end_reason` (`miss`/`sneeze`/`quit`) | Конец забега |
| `new_record` | `height`, `prev` | Побит рекорд |
| `continue_offer` | `height`, `option` (`ad`/`berries`/`both`: что окно предлагает) | Показано окно продолжения |
| `continue_used` | `height`, `method` | Игрок продолжил |
| `level_up` | `level` | Новый уровень пекаря |
| `creature_unlock` | `creature`, `source` | Получено существо |
| `creature_upgrade` | `creature`, `level` | Прокачка |
| `team_change` | `team` | Изменена бригада |
| `mission_complete` | `mission`, `tier` | Задание выполнено |
| `mission_chest` | — | Забран сундук дня |
| `streak_day` | `count`, `cycle` | Засчитан день серии |
| `streak_lost` | `count` | Серия сброшена |
| `streak_restore` | `method` | Серия восстановлена |
| `daily_attempt` | `attempt`, `height` | Попытка в башне дня |
| `gift_open` | `doubled` | Открыт подарок |
| `ad_rewarded_show` | `placement` | Начат показ |
| `ad_rewarded_result` | `placement`, `result`, `reason` (только при `unavailable` и когда сервис назвал причину: `offline`/`no_fill`) | Итог показа |
| `ad_interstitial_show` | — | Показана межстраничная |
| `shop_open` | `source` | Открыт магазин |
| `journal_open` | — | Открыт журнал пекаря |
| `map_open` | — | Открыта карта подъёма |
| `games_sign_in` | `source` (`board`/`achievements`/`settings`: откуда игрок попросил вход), `result` (`ok`/`fail`) | Итог входа в Game Center по нажатию игрока (тихий вход при запуске не пишется) |
| `games_board_open` | `board` (`classic_height`/`daily_height`) | Открыта таблица рекордов Game Center |
| `games_achievements_open` | — | Открыт список достижений Game Center |
| `iap_start` | `product` | Нажата покупка |
| `iap_result` | `product`, `result` | Итог покупки |
| `currency_spend` | `currency`, `amount`, `item` | Трата |
| `currency_earn` | `currency`, `amount`, `source` | Крупное начисление (не каждая монета, а итог источника) |
| `notif_permission` | `granted` | Ответ на запрос уведомлений |
| `settings_change` | `key`, `value` | Изменение настройки |

### Свойства пользователя
`baker_level`, `creatures_owned`, `best_height_bucket` (`0-19`, `20-49`, `50-99`, `100+`), `payer` (`0`/`1`: куплено что-либо), `install_age_bucket` (дней с создания сохранения: `0`, `1`, `2-3`, `4-7`, `8-14`, `15-30`, `31+`). Имя `days_since_install_bucket` из первой версии таблицы не годится: у Firebase имя свойства не длиннее 24 символов, а в нём 25. Границы корзин лежат в `data/app/telemetry.ts` (`TELEMETRY`). Идентификатор игрока и установки в аналитику не уходит.

### На что смотреть в отчётах
- Воронка обучения: `tutorial_step` по шагам.
- Распределение `run_end.height` в первой сессии и по дням.
- Доля забегов с `continue_used`.
- Какие существа стоят в бригадах (`run_start.team`) и как это связано с высотой.
- Удержание по дням в разрезе «играл в башню дня / не играл», «есть серия ≥ 3 / нет».

## 7. Сбои

Firebase Crashlytics (`services/crash/`: интерфейс `CrashService` с `recordError(error, context)` и `crash()` для проверки; `native.ts` на плагине, `web.ts` печатает `[crash] …` только в разработке). Как и аналитика, нативная реализация включается только при файле настроек Firebase своей системы, иначе тихая браузерная.

Глобальный обработчик (`services/crash/reporter.ts`, подключается первой строкой `start()` в `main.ts`, `game/app/crash-reporting.ts`): слушает `error` и `unhandledrejection` окна и записывает нефатальные ошибки с именем текущей сцены (ключи включённых сцен через `+`, например `game+hud`) и версией сохранения. Сцена и версия идут как пользовательские ключи Crashlytics `scene`, `save_version` (и `report_kind`: `error`, `rejection`, `effect:<имя>`, `test`), стек разбирается в кадры для группировки (в имени файла только последняя часть). Обработчик не бросает ошибок и не мешает браузеру печатать ошибку (в разработке она видна в консоли). Один и тот же сбой (сообщение и верх стека) не отправляется дважды, всего не больше 25 отчётов за загрузку страницы, безобидные сообщения браузера (`ResizeObserver loop`, `Script error.`) не отправляются. Числа: `CRASH` в `data/app/telemetry.ts`.

Эффекты, которые `fxGuard` молча пропускает, тоже уходят в Crashlytics нефатально: один отчёт на имя эффекта за загрузку страницы, не больше 8 эффектов за загрузку (иначе поломка украшения затопила бы отчёты). Ядро (`src/core`, шаг симуляции, очки, сохранение) через `fxGuard` не идёт, его ошибки доходят до обработчика окна как обычные.

Остановку цикла кадров ловит сторож (`game/app/loop/loop-watch.ts`, `docs/08-architecture.md`, «Сторож цикла кадров»): после перезапуска цикла уходит нефатальный отчёт с видом `loop-stall` и именем сцены, а когда пределы перезапусков исчерпаны, один отчёт `loop-stall-gave-up`. Самих исключений, которые остановили цикл, сторож не дублирует: они приходят обработчиком окна. Эти отчёты тоже считаются в `CRASH.sessionMax`.

Проверка на телефоне (внутренняя сборка с файлом настроек Firebase): отладочное меню, раздел «Events and failure reports», кнопки «Test non-fatal» (нефатальная запись) и «Test crash (app closes)» (настоящий вылет; отчёт о вылете уходит при следующем запуске приложения). Результат виден в Firebase, Crashlytics, через несколько минут.

## 8. Уведомления

```ts
export interface NotificationsService {
  requestPermission(): Promise<boolean>;
  hasPermission(): Promise<boolean>;
  rescheduleAll(plan: Array<{ id: number; at: Date; titleKey: string; bodyKey: string }>): Promise<void>;
  cancelAll(): Promise<void>;
}
```

План уведомлений строит чистая функция `core/progression/notif-plan.ts` по сохранению и текущему времени (правила в `04-meta-retention.md`, раздел 7). Вызывается при сворачивании приложения. При открытии или возврате в приложение все запланированные уведомления отменяются (`cancelAll`); новый план строится при следующем сворачивании.

- Слой: `game/app/notif-schedule.ts` связывает оболочку (`appShell.onActiveChange`) с сервисом. Тексты берутся по ключам `titleKey`/`bodyKey` на языке игры в момент постановки.
- Android: уведомления ставятся неточными (`isExactNotification: false`, без `allowWhileIdle`): разрешение на точные будильники из манифеста убрано намеренно, и плагин не должен открывать экран «Будильники и напоминания». Android 13+ просит `POST_NOTIFICATIONS` через `requestPermissions`. Малый однотонный значок `ic_stat_notify` и цвет заданы в `capacitor.config.json`.
- Разрешение запрашивается после 3-го завершённого забега своим окном (`home-asks.ts`; тихое обновление согласия не занимает место вопроса, окно появляется на том же входе на Home); ответ пишется в событие `notif_permission` с параметром `granted`.
- Браузер: заглушка ничего не ставит, в разработке пишет план в консоль. В отладочном меню (разработка и внутренняя сборка) есть кнопка проверки: уведомление через минуту.

## 9. Время и защита от перевода часов

- Источник времени один: `util/clock.ts` (в разработке учитывает `?dayOffset=N`, целое от -3650 до 3650; `?reset=1` только в разработке начинает новое сохранение). Дни считают `localDay` (серия, задания) и `utcDay` (башня дня) из `util/calendar.ts` (чистая арифметика без зависимостей от сборки: её берут ядро и `npm run sim`).
- Если текущее время меньше `lastSeenAt` более чем на допуск (10 минут, `CLOCK_BACK_TOLERANCE_MS` в `data/app/clock.ts`; проверка `clockWentBack` в `util/calendar.ts`), считаем, что часы перевели назад: серия не растёт, подарок не выдаётся, задания не обновляются до тех пор, пока время не превысит `lastSeenAt`.
- Перевод часов вперёд не отслеживается: без сервера это ненадёжно, а выгода игрока мала.

## 10. Конфиденциальность

Игра не требует аккаунта, не собирает имя, почту, контакты, геопозицию. Данные собирают сторонние SDK: AdMob (рекламный идентификатор, примерное местоположение по IP, данные об использовании), Firebase (данные об использовании, диагностика), RevenueCat (история покупок).

Это нужно отразить:
- в политике конфиденциальности (страница на сайте разработчика, ссылка в настройках и в сторах);
- в разделе «Конфиденциальность приложения» в App Store Connect;
- в разделе «Безопасность данных» в Google Play;
- в файле манифеста конфиденциальности iOS `ios/App/App/PrivacyInfo.xcprivacy` (этап M8, лежит в ресурсах приложения). Каждый SDK приносит свой манифест со своими доменами отслеживания; манифест приложения — их объединение для отчёта о конфиденциальности App Store: `NSPrivacyTracking` = нет и пустой `NSPrivacyTrackingDomains` (ITMS-91064: при `true` нужен хотя бы один домен отслеживания, а запросы к таким доменам при отказе от ATT не проходят; сама игра доменов отслеживания не вызывает, а Google Mobile Ads в своём манифесте тоже ставит `false` и доменов не перечисляет, `11a-device-build.md`, раздел 2.1), собираемые данные: рекламный идентификатор (сторонняя реклама, аналитика; отслеживание), взаимодействие с продуктом и рекламные данные (аналитика, реклама), примерное местоположение по IP (реклама), сбои, производительность и прочая диагностика (работа приложения), история покупок (работа приложения, аналитика); ничего не привязано к личности, аккаунтов нет. Из API с обязательной причиной сама игра использует только `UserDefaults` (сохранение через `@capacitor/preferences`, причина `CA92.1`). Сверять таблицу с `11-release-store.md`, раздел 3, при каждом новом SDK.

**Game Center (1.1).** Данные Game Center (вход игрока, счёт таблиц, проценты достижений) собирает Apple через свой системный GameKit; игра их никуда, кроме GameKit, не отправляет и обратно на свой сервер не получает (своего сервера нет). По правилам раздела «Конфиденциальность приложения» Apple за данные, которые собирает сама Apple, разработчик не отчитывается («You are not responsible for disclosing data collected by Apple», страница App Privacy Details), поэтому ярлыки конфиденциальности от Game Center не меняются. GameKit не входит в API с обязательной причиной, и `PrivacyInfo.xcprivacy` не меняется. События `games_*` (раздел 6) идут в Firebase вместе с остальными и личных данных не несут. В политику конфиденциальности на сайте добавляется строка о Game Center (действие владельца).

**iCloud (1.1).** Копия сохранения лежит в iCloud самого игрока (хранилище «ключ-значение» приложения): разработчик её не видит и не получает, своего сервера нет. По определению Apple данные «собраны», когда они уходят с устройства и хранятся в читаемом виде у разработчика или его партнёров дольше, чем нужно для ответа на запрос; за данные, собранные Apple, разработчик не отчитывается (страница App Privacy Details, https://developer.apple.com/app-store/app-privacy-details/). Поэтому ярлыки конфиденциальности от iCloud не меняются. В копии нет личных данных: только прогресс игры, настройки и `installId` (Apple советует не класть в это хранилище личное: оно лежит на диске без шифрования). `NSUbiquitousKeyValueStore` в перечне API с обязательной причиной не значится (категория «User defaults» описывает `UserDefaults`), поэтому `PrivacyInfo.xcprivacy` не меняется; страницы Apple с перечнем категорий при сверке не открылись, сверить по отчёту о конфиденциальности Xcode при архивации сборки 1.1 (действие владельца). В политику конфиденциальности на сайте добавляется строка об iCloud (действие владельца).

Перечень в `11-release-store.md`.

## 12. Оценка игры и сведения об устройстве (M8)

**Оценка.** Сервис `services/rating/` (`types.ts`, `web.ts`, `native.ts`; выбор в `services/index.ts`): один метод `requestReview()`. В приложении он зовёт `InAppReview.requestReview()` из `@capacitor-community/in-app-review` 8.0.0 (системное окно: StoreKit на iOS, Play In-App Review на Android; системные квоты у них свои, окно может не показаться, приложение этого не узнаёт). Ошибка плагина глотается. В браузере заглушка: в разработке строка в консоль, в игровой сборке ничего. Своего окна, вопроса «Нравится ли игра?» и кнопки «Оцените нас» нет. Когда просить и как это записывается в сохранение (`review.*`) — `04-meta-retention.md`, раздел 10. Аналитики у просьбы пока нет.

**Сведения об устройстве.** `AppShellService.deviceInfo(): Promise<{ model: string; os: string }>` и `AppShellService.appBuild(): Promise<string | null>` нужны одному месту: письму «Написать нам» (`07-ui-screens.md`, раздел 13). В браузере модель и ОС разбираются из `navigator.userAgent` (`services/app-shell/device-info.ts`, по возможности: «iPhone / iOS 18.1», «Pixel 7 / Android 15»). В приложении `deviceInfo` зовёт собственный плагин проекта `TippyDevice` (`registerPlugin('TippyDevice')`, метод `get(): Promise<{ model: string; osVersion: string; platform: string }>`; нативная часть на Swift и Java лежит в `ios/` и `android/`), при ошибке плагина падает обратно на разбор user agent. `appBuild` в приложении берёт номер сборки из `App.getInfo().build` (`@capacitor/app`), в браузере `null`. Идентификаторов устройства (IDFA, IDFV, серийных) плагин не читает: модель и версия системы.

## 13. Игровые сервисы: Game Center (1.1)

Правила таблиц и достижений — `04-meta-retention.md`, раздел 13; кнопки — `07-ui-screens.md`.

**Сервис** `services/games/` (`types.ts`, `web.ts`, `native.ts`, `status-hub.ts`; выбор в `services/index.ts`): состояние `unavailable` / `signed_out` / `signed_in` и подписка на его смену, `start()` (тихо, без системных окон, повторный вызов ничего не делает), `signIn()` (по нажатию игрока, может открыть системное окно), `submitScore`, `showBoard`, `reportAchievements`, `showAchievements`. Ни один метод не бросает исключений: пропавший плагин или его отказ дают `unavailable`, сбой отправки при выполненном входе молча пропускается (таблица хранит лучшее, следующая отправка догонит). На iOS — `NativeGames` над плагином `TippyGames`, на Android в 1.1 и в браузере — `WebGames` в состоянии `unavailable` (в разработке режимы `?games=`, `08-architecture.md`, раздел 8). До `start()` состояние `unavailable`, поэтому кнопки появляются в окнах, открытых после тихого входа на Home.

**Плагин `TippyGames`** (`ios/App/App/TippyGamesPlugin.swift`, регистрируется в `GameViewController.swift` рядом с `TippyDevice`; возможность Game Center записана в `ios/App/App/App.entitlements` (`com.apple.developer.game-center`) и в проект Xcode):
- `start` ставит `GKLocalPlayer.local.authenticateHandler` и отвечает после первого ответа GameKit. Если GameKit отдаёт окно входа, оно не показывается, а запоминается до `signIn`; без окна и без входа (игрок раньше отказался) — `signed_out`, а `signIn` отвечает `false`; ошибка «не поддерживается» — `unavailable`. GameKit зовёт обработчик и позже (игрок вошёл через Настройки, пока игра была в фоне): плагин посылает событие `status`. Плавающая кнопка Game Center (`GKAccessPoint`) не показывается: она перекрыла бы HUD.
- `signIn` показывает запомненное окно входа и отвечает, когда GameKit ответит снова; если окно закрыли, а GameKit молчит, — через 1,5 с после закрытия по состоянию игрока (и не дольше 180 с).
- `submitScore` загружает таблицу (`GKLeaderboard.loadLeaderboards`) и отправляет счёт через её объект: для повторяющейся таблицы так счёт попадает в идущий период (документация Apple). Отвечает `ok`: дошёл ли счёт.
- `reportAchievements` читает, что уже хранит Game Center (`GKAchievement.loadAchievements`), и отправляет только выросшие проценты (`GKAchievement.report`, баннер получения показывает система); если прочитать не удалось, не отправляет ничего (`ok: false`).
- `showBoard` и `showAchievements`: на iOS 26 и новее через `GKAccessPoint.shared.trigger(…)` (окно `GKGameCenterViewController` там устарело), на iOS 15–25 через `GKGameCenterViewController`. Обработчик закрытия у `trigger` по известной ошибке GameKit может не прийти, поэтому плагин ни на что после показа не ждёт.

**Отправка** — `game/games/games-sync.ts`: при переходе в `signed_in`, после каждого забега, дошедшего до сохранения (`gameState.onRunRecorded`), и при входе на Home отправляются выросшие с прошлой дошедшей отправки этого запуска счёт (`boardScores`, `newScores`) и проценты (`achievementPercents`, `risenAchievements`). Отправка, которая не дошла (плагин отвечает `ok: false`), не считается отправленной и повторяется при следующей; при выходе из Game Center память об отправленном стирается, чтобы другой вошедший аккаунт получил всё. Связка ставится один раз при запуске (`bindGames` в `main.ts`) и не ставится, пока действует отладочная подмена, которая пишет в сохранение (`overridesSave`: `?dayOffset=`, `?team=`, `?level=`); после отладочной записи из меню отладки (уровень, забеги, существа) до конца запуска ничего не отправляется (`gameState.debugTouched`). Тихий вход — `startGamesOnHome` после входа на Home, если `tutorial.firstRunDone`.

**Пределы Game Center** (App Store Connect, справка Apple): до 100 достижений, до 100 очков на одно и 1000 на игру; картинка достижения 1024×1024 PNG или JPEG, RGB; до 100 таблиц без наборов; идентификаторы постоянные, до 100 знаков; очки и идентификаторы после выхода не меняются, вышедшее достижение нельзя удалить; повторяющаяся таблица задаётся началом (UTC) и длительностью; счёт — 64-битное целое. Таблицы и достижения проходят проверку Apple вместе с версией.

## 14. Облачное сохранение: iCloud (1.1)

Правила копии и слияния — `08-architecture.md`, раздел 5, «Облачная копия»; окна — `07-ui-screens.md`, раздел 2.4.

**Сервис** `services/cloud-save/` (`types.ts`, `web.ts`, `native.ts`; выбор в `services/index.ts`):

```ts
export interface CloudSaveService {
  available(): Promise<boolean>;                         // iCloud включён и доступен
  read(): Promise<string | null>;                        // текст облачной копии или null
  write(text: string, previous?: string): Promise<boolean>; // previous: прежняя копия другого устройства во второй ключ
  onRemoteChange(listener: () => void): () => void;      // копию изменило другое устройство (или пришла первая синхронизация)
}
```

Чтение и запись могут отказать (`read` отклоняется, `write` отвечает `false`), это обрабатывает `CloudSync`. На iOS — `NativeCloudSave` над плагином `TippyGames`; на Android в 1.1 и в сборке для браузера — заглушка, у которой облака нет (`available()` = `false`, строки и окон облака нет); режимы заглушки в разработке — `08-architecture.md`, раздел 8.

**Плагин** (`ios/App/App/TippyGamesPlugin.swift`, хранилище `NSUbiquitousKeyValueStore.default`; возможность iCloud «Key-value storage» записана в `App.entitlements`: `com.apple.developer.ubiquity-kvstore-identifier` = `$(TeamIdentifierPrefix)$(CFBundleIdentifier)`, и в проект Xcode):
- При загрузке плагина подписка на `didChangeExternallyNotification` и `synchronize()` (Apple: подписаться вскоре после запуска, `synchronize()` звать при запуске и при возврате из фона; плагин зовёт его и по `UIApplication.willEnterForegroundNotification`). Уведомление с причиной `ServerChange` (копию изменило другое устройство), `InitialSyncChange` (идёт первая загрузка с серверов) или `AccountChange` (сменилась учётная запись: Apple заменяет данные прежней учётной записи данными новой) уходит в игру событием `cloudChange` с причиной; `QuotaViolationChange` только пишется в журнал. Уведомлением хранилища для игры (`onRemoteChange`, в том числе для правила первой записи) считаются только `ServerChange` и `InitialSyncChange`: после смены учётной записи облако читается заново при возврате в игру, и смена учётной записи не открывает первую запись раньше срока. Событие держится, пока его не заберёт слушатель (`retainUntilConsumed`), поэтому уведомление до подписки игры не теряется.
- `cloudAvailable`: `FileManager.default.ubiquityIdentityToken != nil`. Хранилище «ключ-значение» работает и без учётной записи (изменения остаются на устройстве и уходят на сервер после входа), но такая запись ничего не спасает, а признак Apple описывает iCloud Drive; без признака игра считает iCloud выключенным и в облако не пишет (осторожный вариант: при выключенном iCloud Drive облако тоже считается выключенным).
- `cloudRead({ key })` → `{ text }` (без значения — `{}`); `cloudWrite({ key, text, previousKey?, previous? })` пишет прежнюю копию (если дана), затем новую и зовёт `synchronize()`; отвечает `{ ok }` по ответу `synchronize()` (`false` — нет прав хранилища).

**Пределы хранилища** (документация Apple, `NSUbiquitousKeyValueStore`, https://developer.apple.com/documentation/foundation/nsubiquitouskeyvaluestore; `synchronize()`, https://developer.apple.com/documentation/foundation/nsubiquitouskeyvaluestore/synchronize()):
- всего 1 МБ на приложение и игрока, не больше 1024 ключей, одно значение до 1 МБ; длина ключа 128 знаков UTF-16 (старое руководство Apple пишет 64 байта UTF-8; наши ключи короче 20 знаков). Запись сверх квоты не проходит, приходит уведомление `QuotaViolationChange`;
- iCloud обычно принимает «несколько обновлений в минуту», изменения уходят на сервер сами после короткой задержки; игра пишет не чаще раза в `CLOUD.writeIntervalMs` (60 с);
- при первом входе на устройстве данные загружаются с серверов позже; запись во время этой загрузки Apple советует откладывать (`NSUbiquitousKeyValueStoreInitialSyncChange`, https://developer.apple.com/documentation/foundation/nsubiquitouskeyvaluestoreinitialsyncchange) — отсюда правило первой записи; гарантии, что уведомление о первой загрузке придёт всегда, Apple не даёт, поэтому есть и срок `CLOUD.firstWriteWaitMs`;
- смена учётной записи iCloud (`NSUbiquitousKeyValueStoreAccountChange`, https://developer.apple.com/documentation/foundation/nsubiquitouskeyvaluestoreaccountchange): данные прежней учётной записи удаляются, приходят данные новой.

**Размер копии** (замер 2026-11-28): сохранение версии 11 у игрока со всеми существами 5-го уровня, заданиями, всеми контрольными точками и подсказками и полным списком из 50 транзакций — 4,0 КБ текста; копия с `lineage` из 50 id — 6,1 КБ, из 200 id (`CLOUD.lineageKeep`) — около 11,9 КБ (id в кавычках и с запятой — 39 знаков); две копии (основная и прежняя) — около 24 КБ, запас к пределу 1 МБ больше чем в 40 раз. Копия длиннее `CLOUD.maxTextChars` (256 КБ) не отправляется.

**Проверено только в браузере и сборкой.** Поведение на устройствах (первая синхронизация после переустановки, выключенный iCloud, смена учётной записи, авиарежим, два устройства) проверяет владелец на внутренней сборке (`10-roadmap.md`).

