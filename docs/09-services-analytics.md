# 09. Сервисы и аналитика

Все нативные возможности подключаются через Capacitor-плагины и спрятаны за интерфейсами в `src/services/`. Названия плагинов ниже являются кандидатами: перед установкой проверить, что плагин поддерживает текущую версию Capacitor, Swift Package Manager и обновлялся в последние 6 месяцев. Если нет, выбрать аналог и записать в журнал решений.

## 1. Плагины

| Задача | Кандидат | Этап |
|---|---|---|
| Хранилище | `@capacitor/preferences` 8.0.1 (поставлен) | M7 |
| Вибрация | `@capacitor/haptics` 8.0.2 (поставлен) | M7 |
| Беззвучный режим | плагин не нужен: звуковая сессия iOS `ambient` (нативно в `AppDelegate` и `navigator.audioSession` страницы) сама молчит при выключенном звуке; `services/silent-mode/` в приложении — та же заглушка «никогда не беззвучно» (журнал `08`, 2026-11-19) | M7 |
| Жизненный цикл приложения, кнопка «назад» Android | `@capacitor/app` 8.1.2 (поставлен; `services/app-shell/`) | M7 |
| Внешние ссылки (страницы сайта из настроек) | без плагина: `AppShellService.openExternal`; в приложении переход на внешний адрес, его перехватывает оболочка Capacitor и отдаёт системе (iOS `UIApplication.open`, Android `Intent.ACTION_VIEW`), в браузере — новая вкладка | M7 (2026-11-20) |
| Заставка, системные панели | `@capacitor/splash-screen` 8.0.2 (поставлен); строка состояния — `SystemBars` из ядра Capacitor 8 вместо `@capacitor/status-bar`; цвет значков следует за экраном (`AppShellService.setBarIcons`, `08-architecture.md`, журнал 2026-11-20) | M7 |
| Локальные уведомления | `@capacitor/local-notifications` 8.3.1 (поставлен; `SCHEDULE_EXACT_ALARM` убран из манифеста) | M8 |
| Поделиться | `@capacitor/share` + `@capacitor/filesystem` | M8 |
| Реклама | `@capacitor-community/admob` 8.2.1 (поставлен; не новее: с 8.3 лишняя зависимость, журнал `08`, 2026-11-20) | M8 |
| Покупки | `@revenuecat/purchases-capacitor` 14.1.2 (поставлен) | M8 |
| Аналитика и сбои | `@capacitor-firebase/analytics`, `@capacitor-firebase/crashlytics` 8.6.0 (поставлены; работают, только если в проекте есть файл настроек Firebase) | M8 |
| Запрос отслеживания (iOS) и форма согласия UMP | входят в плагин AdMob (`requestTrackingAuthorization`, `requestConsentInfo`, `showConsentForm`, `showPrivacyOptionsForm`) | M8 |
| Системная просьба оценить игру | `@capacitor-community/in-app-review` 8.0.0 (поставлен, одобрен владельцем 2026-11-20; StoreKit и Play In-App Review) | M8 |

## 2. Хранилище

```ts
export interface StorageService {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}
```

Реализация приложений (M7): `services/storage/native.ts` на `@capacitor/preferences` (UserDefaults на iOS, SharedPreferences на Android). Те же строки под теми же ключами, что в браузере (формат сохранения не меняется, тест `native.test.ts`); сохранение переживает выгрузку приложения из памяти и пишется сразу при уходе приложения в фон (`game/app/native-shell.ts`). Ошибки плагина не прячутся: чтение со сбоем даёт `read_failed`, запись со сбоем повторяется (`08`, раздел 5).

Реализация для браузера: `services/storage/web.ts` на `localStorage`; любое обращение обёрнуто в `try/catch`, при сбое (приватный режим, заблокированные данные сайта, переполнение) значения живут в памяти страницы, исключений нет. Ключи: `save`, `save_backup`, `save_corrupt_*`. Формат и правила в `08-architecture.md`, раздел 5. Облачного сохранения в 1.0 нет: при удалении приложения прогресс теряется. Об этом честно сказано в окне сброса прогресса и в описании поддержки. Разовые покупки восстанавливаются через стор.

## 3. Реклама

```ts
export type RewardedPlacement =
  | 'continue' | 'double_coins' | 'gift_double' | 'daily_attempt' | 'streak_restore' | 'shop_coins'
  | 'checkpoint_start';

/** Why no rewarded ad can be shown: the device has no network, or there is no ad for any other reason. */
export type RewardedUnavailableReason = 'offline' | 'no_fill';

export interface AdsService {
  init(): Promise<void>;                       // after consent
  isRewardedReady(): boolean;
  /** null while an ad is ready; otherwise why not. Read when an ad button is built and after 'unavailable'. */
  rewardedUnavailableReason(): RewardedUnavailableReason | null;
  showRewarded(p: RewardedPlacement): Promise<'rewarded' | 'dismissed' | 'unavailable'>;
  showInterstitial(): Promise<boolean>;        // only shows; the rules are decided by the caller (core/economy/video-policy.ts)
  setRemoveAds(v: boolean): void;
}
```

- **Причина недоступности** (решение владельца 2026-11-16, этап «Мастерство существ»). `rewardedUnavailableReason()` возвращает `null`, пока реклама готова (`isRewardedReady()` истинно) или занята показом другой (это не недоступность: кнопка тогда пишет прежнее «Реклама недоступна», а в аналитике `reason` не пишется), иначе причину. `'offline'` — только когда устройство само сообщает, что сети нет (`navigator.onLine === false` в WebView; новых плагинов не нужно); всё остальное — `'no_fill'`: реклама не загрузилась, сеть рекламы не ответила, домены рекламы закрыты блокировщиком (при DNS-блокировщике сеть у устройства есть, поэтому кнопка честно пишет «Реклама недоступна», как требует критерий M8). Ответ `showRewarded` прежний: `'unavailable'` без причины, причину вызывающий читает отдельно. Подпись кнопки по причине делает одна функция (`07-ui-screens.md`, общие правила интерфейса).
- После инициализации заранее загружается одна реклама за награду и одна межстраничная; после показа сразу загружается следующая.
- Правила показа межстраничной рекламы описаны в `05-economy-monetization.md`; решение принимает чистая функция `core/economy/video-policy.ts` (`canShowInterstitial`, покрыта тестами), а сервис `showInterstitial()` правил не знает и только показывает рекламу (`true`, если показал). Вызывает его единственное место, `game/economy/interstitial-flow.ts`.
- На время показа рекламы музыка и звуки приостанавливаются, игра на паузе. У `AudioService.suspend(reason)` / `resume(reason)` причина `'app'` (сворачивание) или `'ad'` (реклама); звук возвращается, только когда не держится ни одна причина.
- Браузерная заглушка: `services/rewarded-video/web.ts` (серый DOM-экран на 2 секунды, затем `'rewarded'`; межстраничная показывает такой же экран на 2 секунды со своей подписью и отвечает `true`, в режимах недоступности ничего не показывает и отвечает `false`). Режимы `reward`, `dismissed`, `no_fill` (прежний `unavailable`) и `offline` переключаются кнопкой в панели отладки (`?debug=1`) через `adsDev` (интерфейс `AdsDevControl`, не входит в `Services`); в режимах `no_fill` и `offline` `isRewardedReady()` ложно, `showRewarded` отвечает `'unavailable'`, а `rewardedUnavailableReason()` — `'no_fill'` или `'offline'` соответственно. Настоящее состояние сети браузера заглушка не читает: обе причины проверяются только переключателем. Нативная реализация: `services/rewarded-video/native.ts` (см. ниже). **Сборка для игроков** (не dev-сервер и не внутренняя, `DEBUG_TOOLS` ложно) до M8 не показывает тестовую рекламу: заглушка стоит в режиме `no_fill`, кнопки рекламы пишут «Реклама недоступна», межстраничной нет (решение 2026-11-20, сборка закрытого теста Google Play).
- **Нативная реализация (M8, 2026-11-20)**: `services/rewarded-video/native.ts` на `@capacitor-community/admob` (плагин спрятан за малым интерфейсом `AdsPlugin`, `plugin.ts`, поэтому есть тесты на подменном плагине). Выбирается в `services/index.ts` только в приложении; в браузере остаётся `WebAds`. До `init()` (согласие ещё не пройдено, до первого завершённого забега) всё недоступно: `isRewardedReady()` ложно, причина `'no_fill'`. `init()` запускает SDK и загружает одну награждаемую и одну межстраничную рекламу; после каждого показа сразу грузится следующая. Показ завершается только когда реклама закрыта (событие закрытия), так что звук (`rewarded.ts`, `interstitial-flow.ts`) возвращается вовремя: `'rewarded'` только по событию награды, `'dismissed'` при закрытии без награды, `'unavailable'` при сбое показа или когда реклама не загружена. Неудачная загрузка повторяется с растущими паузами `AD_LOAD.retryDelaysMs` (5, 15, 45, 120 с), потом ждёт, пока реклама понадобится (просьба показать недоступную запускает новую попытку); плотного цикла нет. `showInterstitial()` при `setRemoveAds(true)` не показывает ничего, награждаемая остаётся. Любая ошибка плагина (заблокированные домены рекламы) превращается в `unavailable` / `false`, необработанных отказов нет. Если SDK не запустился или не удалось подписаться на его события (показ тогда не мог бы завершиться), реклама целиком недоступна: загрузок нет, показ отвечает `'unavailable'` / `false`. Страховка: если вызов показа вернулся, а событие закрытия не пришло за `AD_LOAD.showSafetyMs` (120 с, таймер идёт только после возврата вызова показа), показ завершается как закрытый (`'dismissed'`, а при уже пришедшей награде `'rewarded'`; межстраничная отвечает `true`), поэтому поток продолжения и звук не зависают.
- **Рекламные блоки** (`services/rewarded-video/ad-units.ts`, `pickAdUnits`): сервер разработки и внутренняя сборка (`DEBUG_TOOLS`) всегда берут публичные тестовые блоки Google (`SAMPLE_AD_UNITS` в `data/economy/rewarded-video.ts`; это не секреты, их разрешает страж ключей), сборка для магазина берёт `VITE_ADMOB_REWARDED_ID_IOS` / `_INTERSTITIAL_ID_IOS` / `_ANDROID` из `.env`; блок без идентификатора означает «рекламы этого вида нет» (`'no_fill'`), тестовая реклама в магазинной сборке не показывается никогда. Флаги `initializeForTesting` и `isTesting` не нужны: тестовые блоки сами отдают тестовую рекламу.
- Аналитика: у `ad_rewarded_result` с `result` = `unavailable` есть параметр `reason` (`offline` / `no_fill`), если сервис назвал причину; иначе (занят показом, сбой вызова) параметра нет.
- В разработке и во внутренних сборках используются **тестовые идентификаторы** рекламных блоков Google. Боевые идентификаторы берутся из `.env` только в релизной сборке. Нажимать на собственную боевую рекламу нельзя: это ведёт к блокировке аккаунта AdMob.
- Файл `app-ads.txt` разместить на сайте разработчика (тот же сайт, что с политикой конфиденциальности).

## 4. Согласия

Порядок после первого завершённого забега (не при запуске):

1. Форма согласия Google UMP. Показывается только там, где требуется (ЕЭЗ, Великобритания, Швейцария).
2. На iOS: собственное окно-пояснение, затем системный запрос App Tracking Transparency. Текст причины в `Info.plist` (`NSUserTrackingUsageDescription`): «Это позволит показывать более подходящую рекламу и поддерживать игру бесплатной».
3. Инициализация рекламы.

При отказе реклама остаётся, но неперсонализированная. В настройках есть пункт для повторного открытия формы согласия.

Реализация (M8, 2026-11-20): сервис `services/consent/` (`ConsentService`: `gather`, `privacyOptionsRequired`, `showPrivacyOptions`, `trackingStatus`, `requestTracking`; `native.ts` на плагине AdMob, `web.ts` заглушка), решения принимает `game/economy/consent-flow.ts`, подключено первым вопросом входа на Home (`game/ui/menu/consent/consent-ask.ts`, `HOME_ASKS`). За один вход на Home виден не больше одного вопроса: вопрос сообщает `done(shown)`, и если он не показал окно (тихое обновление согласия на каждом запуске), очередь идёт к следующему вопросу, а после первого показанного окна останавливается. Согласие считает показанным только своё окно-пояснение (форму Google сервис не сообщает). Правила:
- Поток идёт при входе на Home, когда `stats.runs >= 1`, один раз за запуск приложения. Первый запуск после первого забега и каждый следующий проходят те же шаги; окон нет, пока их не требует сам UMP: информация UMP обновляется молча при каждом запуске (так Google велит применять UMP), форма показывается только когда UMP сообщает `REQUIRED`.
- Окно-пояснение (`PopupWindow`, ключи `consent.*`, одна кнопка «Продолжить», без крестика) и системный запрос ATT идут только на iOS, только когда статус ATT `notDetermined` и `consent.attAsked` ложно; после запроса `gameState.noteAttAsked()` пишет `consent.attAsked`. На Android и в браузере вопроса нет.
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
- Выдача на запуске (`syncPurchases()` в `game/economy/purchases.ts`, сначала выдача, потом сверка разовых покупок): берутся `completedTransactions()`; транзакцию, которой нет в `iap.processedTx`, выдают целиком, **если дата покупки не раньше `save.createdAt` и не старше `IAP_RULES.launchPayoutDays` (7) дней** (`unpaidTransactions` в `core/economy/purchase-tx.ts`). Так выдаётся одобренная «Попросить купить» и покупка, прерванная убийством приложения между ответом стора и выдачей, в том числе стартовый набор (с монетами и ягодами; уже имеющийся разовый товар `grantProduct` не выдаёт второй раз). Переустановка и сброс прогресса (`createdAt` = момент сброса) старое второй раз не платят, а окно в 7 дней не даёт повторно выдать транзакцию, вытесненную из списка из 50. Одна покупка может быть известна под двумя ид. (RevenueCat в списке аккаунта может показывать свой ид., а в ответе покупки — ид. стора): после покупки в `iap.processedTx` пишутся оба, а совпадение любого считает транзакцию выданной. Транзакция записывается тем же сохранением, что и выдача. Решения 2026-11-20 (по итоговому ревью).
- Нативная реализация: `services/iap/native.ts` (RevenueCat, `@revenuecat/purchases-capacitor`), ключи `VITE_REVENUECAT_API_KEY_IOS` / `_ANDROID`. Без ключа (или если `configure` упал) сервис работает как «стор недоступен»: нет товаров, `purchase` даёт `failed` с причиной `unavailable`, `restore` бросает ошибку (кнопка покажет «Не удалось связаться со стором»), `ownedNonConsumables` и `completedTransactions` пусты. Заглушка в нативной сборке не подставляется никогда. Ошибки плагина: `PURCHASE_CANCELLED_ERROR` → `cancelled`, `PAYMENT_PENDING_ERROR` → `pending`, `NETWORK_ERROR` / `OFFLINE_CONNECTION_ERROR` → `failed` + `network` (сообщение «Магазин недоступен, попробуйте позже»), прочее → `failed`. Необработанных отказов нет.
- Восстановление (`restore`): только разовые товары. `remove_ads` включает флаг; `starter_pack` возвращает только флаг и существо, если его нет; монеты и ягоды набора не платятся повторно (они выданы один раз на устройстве покупки, `withPurchasesRestored` в `core/economy/shop.ts`).
- При каждом запуске `ownedNonConsumables()` сверяется с сохранением (`game/economy/purchases.ts`: ключи товаров попадают в `purchases.*`, затем `services.ads.setRemoveAds`). Старт игры ждёт эту проверку не дольше `BOOT.purchasesWaitMs` (2 с, `data/app/boot.ts`): на медленной сети она доходит в фоне и пишет итог в сохранение, когда придёт.
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
| `iap_start`, `iap_result` | `buyProduct` (`game/economy/purchases.ts`): `product` = ключ товара (`remove_ads`…), не идентификатор магазина; `result` = `purchased`/`cancelled`/`failed`/`pending` |
| `currency_earn` | `GameState` при любом начислении от крупного источника: от 100 монет или от 1 ягоды (`TELEMETRY.earnMin`); не `debug` и не ягоды, подобранные в забеге (их сумма в `run_end`) |
| `notif_permission` | `ensureNotifPermission` в `game/app/notif-permission.ts`, на каждый ответ системного запроса |
| `settings_change` | `GameState.updateSettings`: по событию на каждый сдвинувшийся ключ (`music`, `sfx`, `haptics`, `reducedFx`, `lang`, `notif_gift`, `notif_streak`, `notif_daily`, `notif_comeback`); значение 1/0 или язык |

Согласие (EU). В Firebase есть режим согласия Google (`setConsent`). Осторожный выбор для 1.0: сбор оставлен включённым по умолчанию, `setConsent` и `setEnabled` не вызываются, пользовательский идентификатор не задаётся (`setUserId` не вызывается нигде), сигналы персонализации рекламы игра Analytics не передаёт. Данные только об использовании, без личных данных (раздел 10). Если юрист потребует отдельный выключатель для ЕС, он добавляется как переключатель в настройках и вызов `setEnabled`; решение владельца.

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

Глобальный обработчик (`services/crash/reporter.ts`, подключается первой строкой `start()` в `main.ts`, `game/app/crash-reporting.ts`): слушает `error` и `unhandledrejection` окна и записывает нефатальные ошибки с именем текущей сцены (ключи включённых сцен через `+`, например `game+hud`) и версией сохранения. Сцена и версия идут как пользовательские ключи Crashlytics `scene`, `save_version` (и `report_kind`: `error`, `rejection`, `effect:<имя>`, `test`), стек разбирается в кадры для группировки (в имени файла только последняя часть). Обработчик не бросает ошибок и не мешает браузеру печатать ошибку как раньше (в разработке она видна в консоли). Один и тот же сбой (сообщение и верх стека) не отправляется дважды, всего не больше 25 отчётов за загрузку страницы, безобидные сообщения браузера (`ResizeObserver loop`, `Script error.`) не отправляются. Числа: `CRASH` в `data/app/telemetry.ts`.

Эффекты, которые `fxGuard` молча пропускает, тоже уходят в Crashlytics нефатально: один отчёт на имя эффекта за загрузку страницы, не больше 8 эффектов за загрузку (иначе поломка украшения затопила бы отчёты). Ядро (`src/core`, шаг симуляции, очки, сохранение) через `fxGuard` не идёт, его ошибки доходят до обработчика окна как обычные.

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
- в файле манифеста конфиденциальности iOS `ios/App/App/PrivacyInfo.xcprivacy` (этап M8, лежит в ресурсах приложения). Каждый SDK приносит свой манифест со своими доменами отслеживания; манифест приложения — их объединение для отчёта о конфиденциальности App Store: `NSPrivacyTracking` = да (реклама может использовать рекламный идентификатор после разрешения ATT), собираемые данные: рекламный идентификатор (сторонняя реклама, аналитика; отслеживание), взаимодействие с продуктом и рекламные данные (аналитика, реклама), примерное местоположение по IP (реклама), сбои, производительность и прочая диагностика (работа приложения), история покупок (работа приложения, аналитика); ничего не привязано к личности, аккаунтов нет. Из API с обязательной причиной сама игра использует только `UserDefaults` (сохранение через `@capacitor/preferences`, причина `CA92.1`). Сверять таблицу с `11-release-store.md`, раздел 3, при каждом новом SDK.

Перечень в `11-release-store.md`.

## 12. Оценка игры и сведения об устройстве (M8, 2026-11-20)

**Оценка.** Сервис `services/rating/` (`types.ts`, `web.ts`, `native.ts`; выбор в `services/index.ts`): один метод `requestReview()`. В приложении он зовёт `InAppReview.requestReview()` из `@capacitor-community/in-app-review` 8.0.0 (системное окно: StoreKit на iOS, Play In-App Review на Android; системные квоты у них свои, окно может не показаться, приложение этого не узнаёт). Ошибка плагина глотается. В браузере заглушка: в разработке строка в консоль, в игровой сборке ничего. Своего окна, вопроса «Нравится ли игра?» и кнопки «Оцените нас» нет. Когда просить и как это записывается в сохранение (`review.*`) — `04-meta-retention.md`, раздел 10. Аналитики у просьбы пока нет.

**Сведения об устройстве.** `AppShellService.deviceInfo(): Promise<{ model: string; os: string }>` и `AppShellService.appBuild(): Promise<string | null>` нужны одному месту: письму «Написать нам» (`07-ui-screens.md`, раздел 13). В браузере модель и ОС разбираются из `navigator.userAgent` (`services/app-shell/device-info.ts`, по возможности: «iPhone / iOS 18.1», «Pixel 7 / Android 15»). В приложении `deviceInfo` зовёт собственный плагин проекта `TippyDevice` (`registerPlugin('TippyDevice')`, метод `get(): Promise<{ model: string; osVersion: string; platform: string }>`; нативная часть на Swift и Java лежит в `ios/` и `android/`), при ошибке плагина падает обратно на разбор user agent. `appBuild` в приложении берёт номер сборки из `App.getInfo().build` (`@capacitor/app`), в браузере `null`. Идентификаторов устройства (IDFA, IDFV, серийных) плагин не читает: модель и версия системы.

