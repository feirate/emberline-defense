import { STUDY_MODES } from './study.mjs';

export function bindCaptainPanel({ store, getProfile, getPacks, getRun, onOpen, switchProfile, updateProfile, restart }) {
  const get = (id) => document.getElementById(id);
  const panel = get('captain-panel');
  const nameField = get('captain-nickname');
  const fileField = get('captain-file');
  let pendingImport;

  function message(text) {
    get('captain-message').textContent = text;
    get('captain-message').hidden = !text;
  }

  function option(value, title) {
    const element = document.createElement('option');
    element.value = value;
    element.textContent = title;
    return element;
  }

  function render() {
    const registry = store.read();
    const active = getProfile();
    const run = getRun();
    const selected = get('captain-switch');
    selected.replaceChildren(...registry.profiles.map(profile => option(profile.id, profile.name)));
    selected.value = active?.id ?? '';
    selected.disabled = !registry.profiles.length;
    get('captain-create').disabled = registry.profiles.length >= 3;
    for (const id of ['captain-rename', 'captain-export', 'captain-delete', 'captain-import-replace']) {
      get(id).disabled = !active;
    }
    get('captain-import-copy').disabled = registry.profiles.length >= 3;
    get('captain-restore').disabled = !active || !Object.hasOwn(registry.backups, active.id);
    get('captain-restart').disabled = !run;

    const units = get('captain-unit');
    units.replaceChildren(...getPacks().map(pack => option(pack.id, pack.label)));
    units.value = active?.packId ?? 'kb3-u4';
    units.disabled = !active || getPacks().length < 2;

    const campaign = active?.campaign;
    get('captain-campaign').textContent = campaign?.bestWave
      ? `最高第 ${campaign.bestWave} 波 · 通关 ${campaign.wins} 次 · 失守 ${campaign.losses} 次`
      : '第一场巡防尚未开始。';
    const wave = run?.battle?.wave;
    get('captain-run').textContent = wave ? `可继续第 ${wave} 波 · ${run.battle.armor} 格护甲` : '当前没有待继续的战局。';
    const records = Object.values(active?.study ?? {});
    get('captain-learning').textContent = records.length ? `练过 ${records.length} 个词。` : '还没有答题记录。';
    const skills = [];
    for (const { mode, label } of Object.values(STUDY_MODES)) {
      let independent = 0;
      let assisted = 0;
      let wrong = 0;
      let timeout = 0;
      let read = 0;
      for (const record of records) {
        const stat = record[mode];
        if (!stat) continue;
        independent += stat.correct - stat.assisted;
        assisted += stat.assisted;
        wrong += stat.wrong;
        timeout += stat.timeouts;
        read += stat.read;
      }
      if (!(independent || assisted || wrong || timeout || read)) continue;
      const row = document.createElement('li');
      row.textContent = `${label} · 独立 ${independent} · 提示后 ${assisted} · 错 ${wrong} · 超时 ${timeout}${read ? ` · 跟读 ${read}` : ''}`;
      skills.push(row);
    }
    get('captain-skills').replaceChildren(...skills);
  }

  function perform(action) {
    try {
      message('');
      action();
      render();
    } catch (error) {
      message(error.message);
    }
  }

  function clearImport() {
    pendingImport = undefined;
    get('captain-import-preview').hidden = true;
  }

  get('captain-button').addEventListener('click', () => {
    onOpen();
    clearImport();
    message('');
    panel.showModal();
    perform(() => {});
  });
  get('captain-close').addEventListener('click', () => panel.close());
  get('captain-switch').addEventListener('change', (event) => perform(() => {
    switchProfile(store.select(event.target.value));
    clearImport();
  }));
  get('captain-create-form').addEventListener('submit', (event) => {
    event.preventDefault();
    perform(() => {
      switchProfile(store.create(nameField.value));
      nameField.value = '';
      clearImport();
    });
  });
  get('captain-rename').addEventListener('click', () => perform(() => {
    const active = getProfile();
    if (!active) return;
    updateProfile(store.rename(active.id, nameField.value));
    nameField.value = '';
  }));
  get('captain-unit').addEventListener('change', (event) => perform(() => {
    const active = getProfile();
    if (!active || !getPacks().some(pack => pack.id === event.target.value)) return;
    updateProfile(store.update(active.id, profile => { profile.packId = event.target.value; },
      { expectedRevision: active.revision }));
    message('本周词包已保存，下次开局生效。');
  }));
  get('captain-export').addEventListener('click', () => perform(() => {
    const active = getProfile();
    const text = store.exportProfile(active.id);
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'emberline-captain.json';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    message('已准备车长备份文件。');
  }));
  get('captain-import').addEventListener('click', () => fileField.click());
  fileField.addEventListener('change', async () => {
    const file = fileField.files[0];
    fileField.value = '';
    if (!file) return;
    clearImport();
    try {
      if (file.size > 1_000_000) throw new Error('请选择小于 1 MB 的余火列车存档。');
      const text = await file.text();
      perform(() => {
        const info = store.previewImport(text);
        pendingImport = text;
        get('captain-import-summary').textContent =
          `${info.name} · 最高第 ${info.bestWave} 波 · 练过 ${info.words} 个词${info.hasRun ? ' · 有待继续的战局' : ''}`;
        get('captain-import-preview').hidden = false;
      });
    } catch (error) {
      message(error.message);
    }
  });

  function finishImport(replace) {
    if (!pendingImport || (replace && !getProfile())) return;
    perform(() => {
      switchProfile(store.importProfile(pendingImport, replace ? { replaceId: getProfile().id } : {}));
      clearImport();
      message(replace ? '已导入。替换前的档案已留作备份。' : '已导入为新车长档案。');
    });
  }
  get('captain-import-copy').addEventListener('click', () => finishImport(false));
  get('captain-import-replace').addEventListener('click', () => finishImport(true));
  get('captain-restore').addEventListener('click', () => perform(() => {
    const active = getProfile();
    if (!active) return;
    switchProfile(store.restoreBackup(active.id));
    message('已恢复导入前的档案。');
  }));
  get('captain-restart').addEventListener('click', () => perform(() => {
    if (confirm('重开会清除这次战况，已保存的学习和关卡记录会保留。确定重开？')) {
      restart();
      panel.close();
    }
  }));
  get('captain-delete').addEventListener('click', () => perform(() => {
    const active = getProfile();
    if (!active || !confirm(`删除「${active.name}」在此浏览器中的档案和战况？`)) return;
    store.deleteProfile(active.id);
    const { profiles, activeId } = store.read();
    switchProfile(profiles.find(profile => profile.id === activeId) ?? null);
    clearImport();
    message('档案已删除。');
  }));
}
