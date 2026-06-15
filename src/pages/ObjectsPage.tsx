import { useState } from 'react';
import { dataService } from '../services/dataService';
import { getSelectedAdminId } from '../utils/adminAuth';
import { isMnevnikiObject } from '../utils/constants';

export const ObjectsPage = (): JSX.Element => {
  const selectedAdminId = getSelectedAdminId();
  const [tick, setTick] = useState(0);
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [notice, setNotice] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingShortName, setEditingShortName] = useState('');

  const objects = dataService.getObjectsByAdmin(selectedAdminId);

  return (
    <section>
      <h1>Объекты</h1>
      {notice && <div className="notice">{notice}</div>}
      <div className="toolbar-row">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Полное название" />
        <input value={shortName} onChange={(event) => setShortName(event.target.value)} placeholder="Короткое" />
        <button
          type="button"
          onClick={() => {
            if (!name.trim()) return;
            dataService.upsertObject({ admin_id: selectedAdminId, name_ru: name.trim(), short_ru: shortName.trim(), active: true });
            setName('');
            setShortName('');
            setTick((value) => value + 1);
            setNotice('Сохранено');
          }}
        >
          Добавить
        </button>
      </div>
      <table className="simple-table" key={tick}>
        <thead>
          <tr>
            <th>Название</th>
            <th>Короткое</th>
            <th>Активность</th>
            <th>Настройки</th>
            <th>Действие</th>
          </tr>
        </thead>
        <tbody>
          {objects.map((objectItem) => {
            const isEditing = editingId === objectItem.id;
            return (
              <tr key={objectItem.id}>
                <td>{isEditing ? <input value={editingName} onChange={(event) => setEditingName(event.target.value)} /> : objectItem.name_ru}</td>
                <td>
                  {isEditing ? <input value={editingShortName} onChange={(event) => setEditingShortName(event.target.value)} /> : objectItem.short_ru}
                </td>
                <td>{objectItem.active ? 'Активен' : 'Неактивен'}</td>
                <td>
                  {isMnevnikiObject(objectItem) ? (
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={objectItem.has_administrator === true}
                        onChange={(event) => {
                          dataService.upsertObject({
                            ...objectItem,
                            has_administrator: event.target.checked
                          });
                          setTick((value) => value + 1);
                          setNotice('Сохранено');
                        }}
                      />
                      Есть администратор
                    </label>
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  <div className="toolbar-row">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            if (!editingName.trim()) return;
                            dataService.upsertObject({
                              id: objectItem.id,
                              admin_id: selectedAdminId,
                              name_ru: editingName.trim(),
                              short_ru: editingShortName.trim(),
                              active: objectItem.active,
                              has_administrator: objectItem.has_administrator
                            });
                            setEditingId(null);
                            setTick((value) => value + 1);
                            setNotice('Сохранено');
                          }}
                        >
                          Сохранить
                        </button>
                        <button type="button" onClick={() => setEditingId(null)}>
                          Отмена
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(objectItem.id);
                          setEditingName(objectItem.name_ru);
                          setEditingShortName(objectItem.short_ru);
                        }}
                      >
                        Редактировать
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        dataService.upsertObject({
                          id: objectItem.id,
                          admin_id: selectedAdminId,
                          name_ru: objectItem.name_ru,
                          short_ru: objectItem.short_ru,
                          active: !objectItem.active,
                          has_administrator: objectItem.has_administrator
                        });
                        if (editingId === objectItem.id) setEditingId(null);
                        setTick((value) => value + 1);
                        setNotice('Сохранено');
                      }}
                    >
                      {objectItem.active ? 'Деактивировать' : 'Активировать'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (!window.confirm(`Удалить объект ${objectItem.name_ru}?`)) return;
                        dataService.removeObject(objectItem.id);
                        if (editingId === objectItem.id) setEditingId(null);
                        setTick((value) => value + 1);
                        setNotice('Объект удален');
                      }}
                    >
                      Удалить
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
};
