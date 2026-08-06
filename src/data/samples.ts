import { SizeOption, NoticeConfig } from '../types';

export const INITIAL_SIZES: SizeOption[] = [
  { id: '6.3x3', name: '6.3 x 3 cm (Estándar Prensa)', widthCm: 6.3, heightCm: 3.0 },
  { id: '6.3x4', name: '6.3 x 4 cm (Mediano Prensa)', widthCm: 6.3, heightCm: 4.0 },
  { id: '6.3x5', name: '6.3 x 5 cm (Alto Prensa)', widthCm: 6.3, heightCm: 5.0 },
  { id: '6.3x6', name: '6.3 x 6 cm (Extendido)', widthCm: 6.3, heightCm: 6.0 },
  { id: '8x5', name: '8 x 5 cm (Tarjeta Ancha)', widthCm: 8.0, heightCm: 5.0 },
  { id: '10x6', name: '10 x 6 cm (Cuadro Grande)', widthCm: 10.0, heightCm: 6.0 },
];

export const DEFAULT_NOTICE_CONFIG: NoticeConfig = {
  headerTitle: '',
  subheaderTitle: '',
  bodyText: '',
  logoUrl: null,
  logoWidthMm: 12,
  logoPosition: 'left',
  size: INITIAL_SIZES[0], // 6.3 x 3 cm
  marginMm: 1,
  fontFamily: 'PT Sans, "Myriad Pro", "Segoe UI", sans-serif',
  headerFontSizePt: 7.0,
  subheaderFontSizePt: 6.0,
  bodyFontSizePt: 6.0,
  lineHeight: 1.32,
  letterSpacingMm: -0.1,
  textAlign: 'justify',
  borderWidthPx: 1.0,
  grayscaleLogo: true,
  contrastMode: 'normal',
  showMarginGuides: true,
  headerAlign: 'center',
  boldKeywords: [],
};

export const SAMPLE_NOTICE_IMAGE: NoticeConfig = {
  headerTitle: 'AVISO ÚNICO',
  subheaderTitle: 'LA DIRECTORA DE TALENTO HUMANO DEL DEPARTAMENTO DE RISARALDA',
  bodyText: `**INFORMA QUE:** El jubilado **DANIEL ECHEVERRI CASTAÑO**, identificado con cédula de ciudadanía No. 1.392.123, falleció el día 19 de JULIO del 2026.
Que con ocasión al fallecimiento del señor **DANIEL ECHEVERRI CASTAÑO**, la señora **EUNICE HOYOS DE ECHEVERRI**, identificada con cédula de ciudadanía No. 25.190.591, en calidad de esposa y actuando a nombre propio solicita el reconocimiento y pago de la sustitución pensional.
Así las cosas, quien crea tener igual o mejor derecho que la solicitante, debe presentarse en la oficina del Fondo Territorial de Pensiones del departamento de Risaralda, ubicado en la calle 19 No. 13-17, primer piso, Gobernación de Risaralda, dentro de los treinta (30) días siguientes a la fecha de esta publicación con el fin de acreditar su derecho.`,
  logoUrl: null,
  logoWidthMm: 12,
  logoPosition: 'left',
  size: INITIAL_SIZES[0], // 6.3 x 3 cm
  marginMm: 1,
  fontFamily: 'PT Sans, "Myriad Pro", "Segoe UI", sans-serif',
  headerFontSizePt: 7.0,
  subheaderFontSizePt: 6.0,
  bodyFontSizePt: 6.0,
  lineHeight: 1.32,
  letterSpacingMm: -0.1,
  textAlign: 'justify',
  borderWidthPx: 1.0,
  grayscaleLogo: true,
  contrastMode: 'normal',
  showMarginGuides: true,
  headerAlign: 'center',
  boldKeywords: ['INFORMA QUE:', 'DANIEL ECHEVERRI CASTAÑO', 'EUNICE HOYOS DE ECHEVERRI'],
};

// Default sample coat of arms shield logo SVG data URL
export const SAMPLE_SHIELD_LOGO = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120" width="100" height="120"><path d="M50 5 L90 20 L90 60 C90 90 50 115 50 115 C50 115 10 90 10 60 L10 20 Z" fill="none" stroke="black" stroke-width="4"/><path d="M50 15 L80 27 L80 57 C80 80 50 100 50 100 C50 100 20 80 20 57 L20 27 Z" fill="none" stroke="black" stroke-width="2"/><circle cx="50" cy="45" r="12" fill="none" stroke="black" stroke-width="3"/><path d="M35 75 Q50 60 65 75 Q50 90 35 75" fill="none" stroke="black" stroke-width="3"/><text x="50" y="49" font-family="sans-serif" font-size="10" font-weight="bold" text-anchor="middle">GOV</text></svg>`;
