function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

export function createMapUI({ onStage, onEndurance, onOpen, onClose }) {
  const get = id => document.getElementById(id);
  const dialog = get('course-map');
  const courseChoices = get('map-courses');
  const stages = get('map-stages');
  const exit = get('map-endurance');
  let view = { courses: [], statuses: {} };
  let selectedCourseId;

  function draw() {
    const { courses, statuses, message, activeStageId, hasEnduranceRun } = view;
    const selected = courses.find(course => course.id === selectedCourseId) ?? courses[0];
    selectedCourseId = selected?.id;

    const buttons = courses.map(course => {
      const button = element('button', 'map-choice', course.title);
      button.type = 'button';
      button.dataset.course = course.id;
      button.setAttribute('aria-pressed', String(course.id === selectedCourseId));
      button.addEventListener('click', () => {
        if (selectedCourseId === course.id) return;
        selectedCourseId = course.id;
        draw();
        courseChoices.querySelector('[aria-pressed="true"]')?.focus();
      });
      return button;
    });
    courseChoices.replaceChildren(...buttons);

    let covered = 0;
    let total = 0;
    const stops = selected?.stages.map(stage => {
      const status = statuses[stage.id] ?? {};
      const count = status.covered ?? 0;
      const target = stage.entries.length;
      covered += count;
      total += target;
      const state = status.cleared ? 'cleared' : status.unlocked ? 'available' : 'locked';
      const item = element('li', 'map-stop');
      item.dataset.state = state;
      const button = element('button', 'map-stage');
      button.type = 'button';
      button.dataset.mapStage = stage.id;
      button.dataset.mapState = state;
      button.disabled = state === 'locked';
      if (stage.id === activeStageId) button.setAttribute('aria-current', 'step');
      const action = button.disabled ? '待解锁' : status.hasRun ? '继续' : status.cleared ? '重玩' : '出车';
      const details = status.cleared ? ' · 已通关' : button.disabled ? ' · 先完成上一趟' : '';
      button.append(
        element('strong', '', stage.title),
        element('span', 'map-stage-action', action),
        element('span', 'map-stage-details', `答对 ${count} / ${target} 词${details}`),
      );
      button.addEventListener('click', () => { if (onStage(stage.id) !== false) close(); });
      item.append(button);
      return item;
    }) ?? [];
    stages.replaceChildren(...stops);
    get('map-station').textContent = selected?.station ?? '';
    get('map-station').parentElement.hidden = !selected;
    get('map-route-progress').textContent = `本站 ${covered} / ${total} 词`;
    const feedback = message || (selected ? '' : '正在读取课程…');
    get('map-message').textContent = feedback;
    get('map-message').hidden = !feedback;
    exit.textContent = hasEnduranceRun ? '继续百波耐久' : '进入百波耐久';
  }

  function open() {
    if (dialog.open || onOpen?.() === false) return;
    const activeCourse = view.courses.find(course => course.stages.some(stage => stage.id === view.activeStageId));
    if (activeCourse) selectedCourseId = activeCourse.id;
    draw();
    dialog.showModal();
  }

  function close() {
    if (dialog.open) dialog.close();
  }

  get('map-button').addEventListener('click', open);
  get('map-close').addEventListener('click', close);
  exit.addEventListener('click', () => { if (onEndurance() !== false) close(); });
  dialog.addEventListener('close', () => onClose?.());

  return {
    open,
    close,
    render(next) {
      view = next;
      if (dialog.open) draw();
    },
  };
}
