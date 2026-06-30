import { useState } from 'react';
import { dataService } from '../services/dataService';
import { firebaseConfig } from '../services/firebase';
import type { FirestoreV2MigrationStatus } from '../services/firestoreRest';

export const SyncDebugPage = (): JSX.Element => {
  const [tick, setTick] = useState(0);
  const [notice, setNotice] = useState('');
  const [migrationStatus, setMigrationStatus] = useState<FirestoreV2MigrationStatus | null>(null);

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

        <div className="summary-card" key={`migration-${tick}`}>
          <h3>Миграция Firestore v2</h3>
          {!migrationStatus && <p>Статус еще не загружен.</p>}
          {migrationStatus && (
            <ul>
              <li>Документ миграции: {migrationStatus.exists ? '✅ есть' : '❌ нет'}</li>
              <li>Миграция завершена: {migrationStatus.completed ? '✅ да' : '❌ нет'}</li>
              <li>Счетчики совпали: {migrationStatus.countsMatch ? '✅ да' : '❌ нет'}</li>
              <li>Дата миграции: {migrationStatus.migratedAt ? new Date(migrationStatus.migratedAt).toLocaleString('ru-RU') : '—'}</li>
              {migrationStatus.sourceCounts && migrationStatus.v2Counts && (
                <li>
                  Старые/новые записи: админы {migrationStatus.sourceCounts.admins}/{migrationStatus.v2Counts.admins}, сотрудники{' '}
                  {migrationStatus.sourceCounts.employees}/{migrationStatus.v2Counts.employees}, объекты{' '}
                  {migrationStatus.sourceCounts.objects}/{migrationStatus.v2Counts.objects}, месяцы{' '}
                  {migrationStatus.sourceCounts.months}/{migrationStatus.v2Counts.months}, планы{' '}
                  {migrationStatus.sourceCounts.plans}/{migrationStatus.v2Counts.plans}, отпуска{' '}
                  {migrationStatus.sourceCounts.vacationRequests}/{migrationStatus.v2Counts.vacationRequests}
                </li>
              )}
            </ul>
          )}
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

        <button
          type="button"
          onClick={async () => {
            const status = await dataService.getV2MigrationStatus();
            setMigrationStatus(status);
            setTick((v) => v + 1);
            setNotice(status ? 'Статус миграции v2 обновлен.' : 'Firebase не настроен.');
          }}
        >
          Проверить статус v2
        </button>

        <button
          type="button"
          onClick={async () => {
            if (!window.confirm('Запустить миграцию Firestore v2? Старый appData/main НЕ будет удален.')) return;
            setNotice('Миграция v2 запущена. Не закрывайте вкладку до завершения.');
            const status = await dataService.migrateToFirestoreV2();
            setMigrationStatus(status);
            setTick((v) => v + 1);
            setNotice(
              status.completed && status.countsMatch
                ? 'Миграция v2 завершена: счетчики совпали, старые данные сохранены.'
                : 'Миграция v2 завершилась с расхождением счетчиков. Старые данные не тронуты.'
            );
          }}
        >
          Мигрировать в Firestore v2
        </button>
      </div>
    </section>
  );
};
