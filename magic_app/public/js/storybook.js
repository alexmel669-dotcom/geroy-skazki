window.storybook = {
  stories: JSON.parse(localStorage.getItem('geroy-storybook') || '[]'),

  add(title, text) {
    this.stories.unshift({ title, text: String(text || '').slice(0, 500), date: new Date().toISOString() });
    if (this.stories.length > 20) this.stories.pop();
    localStorage.setItem('geroy-storybook', JSON.stringify(this.stories));
  },

  render() {
    if (!this.stories.length) return '<p>Здесь будут твои сказки.</p>';
    return this.stories.map((s) =>
      `<div>📖 ${s.title || 'Сказка'}<br><small>${s.text.slice(0, 60)}...</small></div>`
    ).join('');
  }
};

export default window.storybook;
