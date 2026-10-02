import { describe, expect, it } from 'vitest';
import { escaparHtml, nombreCompleto } from './texto';

describe('escaparHtml', () => {
  it('neutraliza etiquetas y comillas', () => {
    expect(escaparHtml('<a href="x">Juan</a> & \'Ana\'')).toBe(
      '&lt;a href=&quot;x&quot;&gt;Juan&lt;/a&gt; &amp; &#39;Ana&#39;'
    );
  });

  it('tolera null', () => {
    expect(escaparHtml(null)).toBe('');
  });
});

describe('nombreCompleto', () => {
  it('une nombre y apellido sin espacios sobrantes', () => {
    expect(nombreCompleto({ nombre: 'Ana', apellido: null })).toBe('Ana');
    expect(nombreCompleto(null)).toBe('');
  });
});
