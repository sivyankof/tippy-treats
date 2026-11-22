# 11a. История сборок и разовых шагов

Перенесено из `docs/11a-device-build.md` 2026-11-22 дословно: шаги 1.2 и 1.3 (уже сделаны), разбор отказа Apple из раздела 2.1, таблицы сборок M8 (6.2) и 1.0 (6.3). Как сейчас — в `docs/11a-device-build.md`.

## 1.2. Сертификат распространения из EAS (уже есть)

Сертификат создал EAS для Arcanum, его закрытая часть хранится в Expo. Выгрузите его к себе (только скачивание, на серверах ничего не меняется). Git Bash:

```
cd /c/Users/Artem/Documents/my-projects/arcanum
npx eas-cli@latest credentials -p ios
```

Ответы на вопросы: профиль сборки **production** → пункт **credentials.json: Upload/Download credentials between EAS servers and your local json** → **Download credentials from EAS to credentials.json**. Появятся файл `credentials.json` (в нём путь к `.p12` и его пароль) и папка `credentials/`. Сразу перенесите их из папки Arcanum в папку ключей, чтобы они не попали в git Arcanum:

```
mkdir -p /c/Users/Artem/Documents/keys/arcanum-eas
mv credentials.json credentials /c/Users/Artem/Documents/keys/arcanum-eas/
```

Профиль Arcanum из этой выгрузки Tippy Treats не нужен, нужен только сертификат.

## 1.3. Профиль App Store для Tippy Treats (новый, один раз)

**Сделано 2026-11-19, повторять не нужно.** Профиль «Tippy Treats App Store» (App ID `app.tippytreats.game`, тот же единственный сертификат распространения, действует до 27.08.2027) лежит в `C:\Users\Artem\Documents\keys\Tippy_Treats_App_Store.mobileprovision`. Шаги ниже — на случай, когда профиль придётся выпустить заново (например, после продления сертификата): без профиля подписать нельзя.

1. https://developer.apple.com/account → **Certificates, Identifiers & Profiles** → **Profiles** → синий **+**.
2. Раздел **Distribution** → **App Store Connect** → **Continue**.
3. **App ID**: `app.tippytreats.game` (Tippy Treats) → **Continue**.
4. Сертификат: тот же, что у Arcanum (тип Distribution, срок до августа 2027; если в списке несколько, выберите с тем же сроком, что у сертификата в `credentials.json`, или спросите сессию) → **Continue**.
5. **Provisioning Profile Name**: `Tippy Treats App Store` → **Generate** → **Download**.
6. Положите файл в `C:\Users\Artem\Documents\keys\` под именем `Tippy_Treats_App_Store.mobileprovision`.

## 2.1. Проверка манифестов конфиденциальности (сессия 10, 2026-11-21)

**Что случилось.** Apple отклонил сборку 1.0 (8) при отправке на проверку: Invalid Binary, ITMS-91064, «NSPrivacyTracking must be true if NSPrivacyTrackingDomains isn't empty» для пути `PrivacyInfo.xcprivacy`.

**Что показала собранная сборка** (пробный прогон GitHub 44826188487, выпускная, `upload: false`; тот же код, что у сборки 8). В `.ipa` 23 манифеста. В корне `.app` лежит наш файл, его содержимое совпадает с `ios/App/App/PrivacyInfo.xcprivacy`: `NSPrivacyTracking` = true, `NSPrivacyTrackingDomains` пустой. Все 22 манифеста библиотек лежат в своих местах (`Frameworks/*.framework/` у Capacitor, Cordova, Google Mobile Ads и UMP, `*.bundle/` у Firebase, GoogleUtilities, GoogleDataTransport, nanopb, Promises и RevenueCat), и у всех `NSPrivacyTracking` = false без доменов. Чужого файла в корне нет, ничего не перезаписано: проект Xcode включает наш манифест один раз (`Copy Bundle Resources`).

**Причина.** Правило Apple действует в обе стороны, хотя текст ошибки называет только одну: «When set to true you need to provide a list of internet domains in NSPrivacyTrackingDomains» (https://developer.apple.com/documentation/bundleresources/privacy-manifest-files). Наш файл ставил `true` без единого домена.

## 6.2. Сборки M8 (2026-11-20)

Все ключи на месте (`.env`, файлы Firebase, десять секретов GitHub; журнал сборки печатает только имена: «Keys of this build: … Not set: none»).

| Сборка | Где | Что внутри |
|---|---|---|
| iOS 0.1.0 (5), внутренняя | TestFlight (GitHub Actions, `internal: true`) | отладочное меню; тестовая реклама Google; RevenueCat (песочница TestFlight); Firebase и Crashlytics (символы отданы при сборке) |
| iOS 0.1.0 (6), выпускная | TestFlight (`internal: false`) | без отладочного меню; боевые идентификаторы AdMob; RevenueCat; Firebase |
| Android 0.1.0 (5), внутренняя | `tippy-treats-store-assets\builds\tippy-treats-0.1.0-5-internal.aab` | отладочное меню; тестовый идентификатор приложения и тестовые блоки Google; RevenueCat; Firebase |
| Android 0.1.0 (6), выпускная | `tippy-treats-store-assets\builds\tippy-treats-0.1.0-6-store.aab` | без отладочного меню; идентификатор приложения и блоки AdMob из `.env`; RevenueCat; Firebase |

## 6.3. Сборки 1.0 (сессия 10, 2026-11-21)

Версия 1.0 (раздел 0), номера по порядку. Журнал GitHub печатает только имена ключей: «Keys of this build: ADMOB_APP_ID_IOS ADMOB_REWARDED_ID_IOS ADMOB_INTERSTITIAL_ID_IOS REVENUECAT_API_KEY_IOS FIREBASE_IOS_PLIST», «Not set: none». Android проверен по содержимому AAB: `versionName` 1.0, `versionCode`, подпись ключом загрузки (`CN=Tippy Treats`, отпечаток как у `tippy-upload-certificate.pem`), ключ RevenueCat и идентификаторы товаров в коде игры, настройки Firebase в ресурсах.

| Сборка | Где | Что внутри |
|---|---|---|
| iOS 1.0 (7), внутренняя | TestFlight (GitHub Actions, запуск 44820041504) | отладочное меню; тестовая реклама Google; RevenueCat; Firebase |
| iOS 1.0 (8), выпускная | TestFlight (запуск 44820059580) | без отладочного меню; идентификаторы AdMob из секретов; RevenueCat; Firebase. **Отклонена Apple при отправке на проверку** (ITMS-91064, раздел 2.1), не использовать |
| iOS 1.0 (9), внутренняя | TestFlight (запуск 44827809107) | как 7, манифест исправлен; проверка манифестов: ok |
| iOS 1.0 (10), выпускная | TestFlight (запуск 44827829585) | как 8, манифест исправлен; проверка манифестов: ok (корень: `NSPrivacyTracking` false, доменов 0, совпадает с репозиторием). Её отправлять на проверку |
| Android 1.0 (7), внутренняя | `tippy-treats-store-assets\builds\tippy-treats-1.0-7-internal.aab` | отладочное меню; тестовые идентификаторы Google; RevenueCat; Firebase |
| Android 1.0 (8), выпускная | `tippy-treats-store-assets\builds\tippy-treats-1.0-8-store.aab` | без отладочного меню; идентификатор приложения и блоки AdMob из `.env`; RevenueCat; Firebase |
