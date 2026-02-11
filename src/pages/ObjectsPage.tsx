import { useState } from 'react';
import { dataService } from '../services/dataService';

export const ObjectsPage = (): JSX.Element => {
  const [tick, setTick] = useState(0);
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [notice, setNotice] = useState('');

  const objects = dataService.getAppData().objects;

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
            dataService.upsertObject({ name_ru: name.trim(), short_ru: shortName.trim(), active: true });
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
            <th>Действие</th>
          </tr>
        </thead>
        <tbody>
          {objects.map((objectItem) => (
            <tr key={objectItem.id}>
              <td>{objectItem.name_ru}</td>
              <td>{objectItem.short_ru}</td>
              <td>{objectItem.active ? 'Активен' : 'Неактивен'}</td>
              <td>
                <button
                  type="button"
                  onClick={() => {
                    dataService.upsertObject({
                      id: objectItem.id,
                      name_ru: objectItem.name_ru,
                      short_ru: objectItem.short_ru,
                      active: !objectItem.active
                    });
                    setTick((value) => value + 1);
                    setNotice('Сохранено');
                  }}
                >
                  {objectItem.active ? 'Деактивировать' : 'Активировать'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
};
