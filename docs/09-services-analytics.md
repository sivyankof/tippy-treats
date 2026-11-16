# 09. Сервисы и аналитика

Все нативные возможности подключаются через Capacitor-плагины и спрятаны за интерфейсами в `src/services/`. Названия плагинов ниже являются кандидатами: перед установкой проверить, что плагин поддерживает текущую версию Capacitor, Swift Package Manager и обновлялся в последние 6 месяцев. Если нет, выбрать аналог и записать в журнал решений.

## 1. Плагины

| Задача | Кандидат | Этап |
|---|---|---|
| Хранилище | `@capacitor/preferences` | M7 |
| Вибрация | `@capacitor/haptics` | M7 |
| Жизненный цикл приложения | `@capacitor/app` | M7 |
| Заставка, статус-бар | `@capacitor/splash-screen`, `@capacitor/status-bar` | M7 |
| Локальные уведомления | `@capacitor/local-notifications` | M8 |
| Поделиться | `@capacitor/share` + `@capacitor/filesystem` | M8 |
| Реклама | `@capacitor-community/admob` | M8 |
| Покупки | `@revenuecat/purchases-capacitor` | M8 |
| Аналитика и сбои | `@capacitor-firebase/analytics`, `@capacitor-firebase/crashlytics` | M8 |
| Запрос отслеживания (iOS) | входит в плагин AdMob или отдельный плагин ATT | M8 |

## 2. Хранилище

```ts
export interface StorageService {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}
```

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
  showInterstitial(): Promise<boolean>;        // only shows; the rules are decided by the caller (core/video-policy.ts)
  setRemoveAds(v: boolean): void;
}
```

- **Причина недоступности** (решение владельца 2026-11-16, этап «Мастерство существ»). `rewardedUnavailableReason()` возвращает `null`, пока реклама готова (`isRewardedReady()` истинно) или занята показом другой (это не недоступность: кнопка тогда пишет прежнее «Реклама недоступна», а в аналитике `reason` не пишется), иначе причину. `'offline'` — только когда устройство само сообщает, что сети нет (`navigator.onLine === false` в WebView; новых плагинов не нужно); всё остальное — `'no_fill'`: реклама не загрузилась, сеть рекламы не ответила, домены рекламы закрыты блокировщиком (при DNS-блокировщике сеть у устройства есть, поэтому кнопка честно пишет «Реклама недоступна», как требует критерий M8). Ответ `showRewarded` прежний: `'unavailable'` без причины, причину вызывающий читает отдельно. Подпись кнопки по причине делает одна функция (`07-ui-screens.md`, общие правила интерфейса).
- После инициализации заранее загружается одна реклама за награду и одна межстраничная; после показа сразу загружается следующая.
- Правила показа межстраничной рекламы описаны в `05-economy-monetization.md`; решение принимает чистая функция `core/video-policy.ts` (`canShowInterstitial`, покрыта тестами), а сервис `showInterstitial()` правил не знает и только показывает рекламу (`true`, если показал). Вызывает его единственное место, `game/interstitial-flow.ts`.
- На время показа рекламы музыка и звуки приостанавливаются, игра на паузе. У `AudioService.suspend(reason)` / `resume(reason)` причина `'app'` (сворачивание) или `'ad'` (реклама); звук возвращается, только когда не держится ни одна причина.
- Браузерная заглушка: `services/rewarded-video/web.ts` (серый DOM-экран на 2 секунды, затем `'rewarded'`; межстраничная показывает такой же экран на 2 секунды со своей подписью и отвечает `true`, в режимах недоступности ничего не показывает и отвечает `false`). Режимы `reward`, `dismissed`, `no_fill` (прежний `unavailable`) и `offline` переключаются кнопкой в панели отладки (`?debug=1`) через `adsDev` (интерфейс `AdsDevControl`, не входит в `Services`); в режимах `no_fill` и `offline` `isRewardedReady()` ложно, `showRewarded` отвечает `'unavailable'`, а `rewardedUnavailableReason()` — `'no_fill'` или `'offline'` соответственно. Настоящее состояние сети браузера заглушка не читает: обе причины проверяются только переключателем. Нативная реализация появится в M7.
- Аналитика: у `ad_rewarded_result` с `result` = `unavailable` есть параметр `reason` (`offline` / `no_fill`), если сервис назвал причину; иначе (занят показом, сбой вызова) параметра нет.
- В разработке и во внутренних сборках используются **тестовые идентификаторы** рекламных блоков Google. Боевые идентификаторы берутся из `.env` только в релизной сборке. Нажимать на собственную боевую рекламу нельзя: это ведёт к блокировке аккаунта AdMob.
- Файл `app-ads.txt` разместить на сайте разработчика (тот же сайт, что с политикой конфиденциальности).

## 4. Согласия

Порядок после первого завершённого забега (не при запуске):

1. Форма согласия Google UMP. Показывается только там, где требуется (ЕЭЗ, Великобритания, Швейцария).
2. На iOS: собственное окно-пояснение, затем системный запрос App Tracking Transparency. Текст причины в `Info.plist` (`NSUserTrackingUsageDescription`): «Это позволит показывать более подходящую рекламу и поддерживать игру бесплатной».
3. Инициализация рекламы.

При отказе реклама остаётся, но неперсонализированная. В настройках есть пункт для повторного открытия формы согласия.

## 5. Покупки

```ts
export interface IapService {
  init(): Promise<void>;
  getProducts(): Promise<Array<{ id: string; priceString: string; title: string }>>;
  purchase(id: string): Promise<'purchased' | 'cancelled' | 'failed' | 'pending'>;
  restore(): Promise<string[]>;     // owned non-consumable ids
  ownedNonConsumables(): Promise<string[]>;
}
```

- Цены в интерфейсе всегда берутся из стора (`priceString`), а не из кода: они зависят от страны.
- Выдача товара происходит **только после подтверждённой покупки**. Расходуемые товары (ягоды) выдаются один раз на транзакцию; идентификаторы обработанных транзакций хранятся в сохранении (последние 50) для защиты от двойной выдачи.
- Состояние `pending` (например, «Попросить купить» в семейном доступе): показать сообщение «Покупка ожидает подтверждения», выдать товар при следующем запуске, когда транзакция завершится.
- При каждом запуске `ownedNonConsumables()` сверяется с сохранением (`game/purchases.ts`: ключи товаров попадают в `purchases.*`, затем `services.ads.setRemoveAds`).
- Идентификаторы товаров в репозитории не лежат: код знает товар по логическому ключу (`data/shop.ts`: `remove_ads`, `starter_pack`, `berries_80` ... `berries_2800`), а ключ в ид. стора переводит `services/iap/product-ids.ts` по переменным `VITE_IAP_*` из `.env` (образец в `.env.example`). Товар без ид. в магазине показывается недоступным.
- Браузерная заглушка: `services/iap/web.ts` (DOM-окно «Купить (тест)?», купленные разовые товары хранит как стор, отдельно от сохранения). Цены в ней — данные заглушки (`data/iap-stub.ts`), в игре цены всегда приходят из `getProducts()`.
- RevenueCat бесплатен до определённого порога месячного дохода; условия проверить на их сайте перед подключением. Альтернатива без посредника: `@capgo/native-purchases` или аналогичный плагин StoreKit 2 / Play Billing.

## 6. Аналитика

Firebase Analytics. Идентификаторы пользователей и личные данные не отправляются. Имена событий и параметров в `snake_case`, не длиннее 40 символов.

```ts
export interface AnalyticsService {
  logEvent(name: string, params?: Record<string, string | number | boolean>): void;
  setUserProperty(name: string, value: string): void;
}
```

В браузере сервис уже есть: `services/telemetry/web.ts` печатает `[telemetry] имя {параметры}` через `console.info` в режиме разработки, в продакшен-сборке молчит; он зарегистрирован как `services.telemetry`. Нативная Firebase-реализация придёт на M8.

Отправляются уже сейчас: `run_start` (сцена забега, только для забегов, которые пишутся в сохранение: не для демо и отладочных `?bot=`, `?start=`, `?team=`, `?level=`; `team` без пустых слотов, `run_index` = число законченных забегов + 1, `game/run-telemetry.ts`), `checkpoint_offer` (`logCheckpointOffer` в `game/checkpoint-start.ts`, окно вызывает его при открытии; `max_height` = старшая открытая точка), `checkpoint_start` и `currency_spend` (`item` = `checkpoint_<высота>`, только за ягоды) из `payForCheckpoint`, `ad_rewarded_show` и `ad_rewarded_result` для каждого места показа (внутри `showRewarded`). Остальные события таблицы появятся позже.

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
| `continue_offer` | `height`, `option` (`ad`/`berries`) | Показано окно продолжения |
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
`baker_level`, `creatures_owned`, `best_height_bucket` (`0-19`, `20-49`, `50-99`, `100+`), `payer` (`0`/`1`), `days_since_install_bucket`.

### На что смотреть в отчётах
- Воронка обучения: `tutorial_step` по шагам.
- Распределение `run_end.height` в первой сессии и по дням.
- Доля забегов с `continue_used`.
- Какие существа стоят в бригадах (`run_start.team`) и как это связано с высотой.
- Удержание по дням в разрезе «играл в башню дня / не играл», «есть серия ≥ 3 / нет».

## 7. Сбои

Firebase Crashlytics. Дополнительно глобальный обработчик ошибок JavaScript (`window.onerror`, `unhandledrejection`) записывает нефатальные ошибки с именем текущей сцены и версией сохранения.

## 8. Уведомления

```ts
export interface NotificationsService {
  requestPermission(): Promise<boolean>;
  hasPermission(): Promise<boolean>;
  rescheduleAll(plan: Array<{ id: number; at: Date; titleKey: string; bodyKey: string }>): Promise<void>;
  cancelAll(): Promise<void>;
}
```

План уведомлений строит чистая функция `core/notif-plan.ts` по сохранению и текущему времени (правила в `04-meta-retention.md`, раздел 7). Вызывается при сворачивании приложения. При открытии приложения все запланированные уведомления отменяются.

## 9. Время и защита от перевода часов

- Источник времени один: `util/clock.ts` (в разработке учитывает `?dayOffset=N`, целое от -3650 до 3650; `?reset=1` только в разработке начинает новое сохранение). Дни считают `localDay` (серия, задания) и `utcDay` (башня дня).
- Если текущее время меньше `lastSeenAt` более чем на допуск (10 минут, `CLOCK_BACK_TOLERANCE_MS` в `data/clock.ts`; проверка `clockWentBack` в `util/clock.ts`), считаем, что часы перевели назад: серия не растёт, подарок не выдаётся, задания не обновляются до тех пор, пока время не превысит `lastSeenAt`.
- Перевод часов вперёд не отслеживается: без сервера это ненадёжно, а выгода игрока мала.

## 10. Конфиденциальность

Игра не требует аккаунта, не собирает имя, почту, контакты, геопозицию. Данные собирают сторонние SDK: AdMob (рекламный идентификатор, примерное местоположение по IP, данные об использовании), Firebase (данные об использовании, диагностика), RevenueCat (история покупок).

Это нужно отразить:
- в политике конфиденциальности (страница на сайте разработчика, ссылка в настройках и в сторах);
- в разделе «Конфиденциальность приложения» в App Store Connect;
- в разделе «Безопасность данных» в Google Play;
- в файле манифеста конфиденциальности iOS (`PrivacyInfo.xcprivacy`), если его не добавляют сами SDK.

Перечень в `11-release-store.md`.
