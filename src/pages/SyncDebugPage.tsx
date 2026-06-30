import { useState } from 'react';
import { dataService } from '../services/dataService';
import { firebaseConfig } from '../services/firebase';

export const SyncDebugPage = (): JSX.Element => {
  const [tick, setTick] = useState(0);
  const [notice, setNotice] = useState('');

  const syncState = dataService.getSyncState();

  return (
    <section>
      <h1>Диагностика Firebase</h1>
      {notice && <div className="notice">{notice}</div>}

      <div className="summary-grid">
        <div className="summary-card">
          <h3>Конфигурация</h3>
          <ul>
            <li>API Key: {firebaseConfig.apiKey ? '✅ задан' : '❌ пусто'}</li>
            <li>Auth Domain: {firebaseConfig.authDomain ? '✅ задан' : '❌ пусто'}</li>
            <li>Project ID: {firebaseConfig.projectId ? '✅ задан' : '❌ пусто'}</li>
            <li>Storage Bucket: {firebaseConfig.storageBucket ? '✅ задан' : '❌ пусто'}</li>
            <li>Messaging Sender ID: {firebaseConfig.messagingSenderId ? '✅ задан' : '❌ пусто'}</li>
            <li>App ID: {firebaseConfig.appId ? '✅ задан' : '❌ пусто'}</li>
          </ul>
        </div>

        <div className="summary-card" key={tick}>
          <h3>Состояние синхронизации</h3>
          <ul>
            <li>Firebase configured: {syncState.configured ? '✅ да' : '❌ нет'}</li>
            <li>Pending push: {syncState.pendingPush ? '⏳ есть' : '✅ нет'}</li>
            <li>Последний успешный pull: {syncState.lastPullAt ? new Date(syncState.lastPullAt).toLocaleString('ru-RU') : '—'}</li>
            <li>
              Следующий pull разрешен:{' '}
              {syncState.nextPullAllowedAt && syncState.nextPullAllowedAt > Date.now()
                ? new Date(syncState.nextPullAllowedAt).toLocaleString('ru-RU')
                : 'сейчас'}
            </li>
            <li>Последняя успешная отправка: {syncState.lastPushAt ? new Date(syncState.lastPushAt).toLocaleString('ru-RU') : '—'}</li>
            <li>Последняя ошибка: {syncState.lastError ?? '—'}</li>
          </ul>
        </div>
      </div>

      <div className="toolbar-row">
        <button
          type="button"
          onClick={async () => {
            const changed = await dataService.pullFromFirestore();
            setNotice(changed ? 'Pull выполнен: получены новые данные из Firestore.' : 'Pull выполнен: новых данных нет или Firebase не настроен.');
            setTick((v) => v + 1);
          }}
        >
          Принудительный Pull из Firestore
        </button>

        <button
          type="button"
          onClick={async () => {
            await dataService.pushToFirestore();
            setNotice('Push выполнен: текущий snapshot отправлен в Firestore (если Firebase настроен).');
            setTick((v) => v + 1);
          }}
        >
          Принудительный Push в Firestore
        </button>

        <button
          type="button"
          onClick={() => {
            setTick((v) => v + 1);
            setNotice('Состояние обновлено.');
          }}
        >
          Обновить статус
        </button>
      </div>
    </section>
  );
};
