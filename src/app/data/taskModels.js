import imgClassification from '../../assets/images/Bildklassifikation.png';
import imgObjectDetection from '../../assets/images/objektdetektion.png';
import imgGesture from '../../assets/images/Gestenerkennung.png';
import imgFace from '../../assets/images/Gesichtsmerkmale.png';
import imgAudio from '../../assets/images/audioerkennung.png';

export const TASK_MODELS = [
  {
    id: 'image-classification',
    name: 'Bildklassifikation',
    description: 'Kameraaufnahmen werden pro Klasse gesammelt, um ein eigenes Bildmodell zu trainieren.',
    image: imgClassification,
    requiresTraining: true,
    inputModality: 'camera',
    interactionType: 'classification',
    bleCapable: true,
    effortLevel: 'Medium',
    defaultInferenceSource: 'camera',
    status: 'available',
    badges: ['Trainierbar', 'Camera', 'BLE'],
  },
  {
    id: 'object-detection',
    name: 'Objekterkennung',
    description: 'Lokalisieren und benennen von Objekten über Bilderfassung.',
    image: imgObjectDetection,
    requiresTraining: true,
    inputModality: 'camera',
    interactionType: 'detection',
    bleCapable: true,
    effortLevel: 'High',
    defaultInferenceSource: 'camera',
    status: 'coming-soon',
    badges: ['Trainierbar', 'Camera', 'BLE'],
  },
  {
    id: 'gesture-recognition',
    name: 'Gestenerkennung',
    description: 'Handlandmarks erzeugen Features, die zu eigenen Gesten trainiert werden.',
    image: imgGesture,
    requiresTraining: true,
    inputModality: 'camera',
    interactionType: 'segmentation',
    bleCapable: true,
    effortLevel: 'Medium',
    defaultInferenceSource: 'camera',
    status: 'available',
    badges: ['Trainierbar', 'Camera', 'Gesten'],
  },
  {
    id: 'face-preview',
    name: 'Gesichtsvorschau',
    description: 'Blendshape-basierte Live-Inferenz ohne vorheriges Training.',
    image: imgFace,
    imageStyle: { objectPosition: 'top' },
    requiresTraining: false,
    inputModality: 'camera',
    interactionType: 'inference-only',
    bleCapable: false,
    effortLevel: 'Low',
    defaultInferenceSource: 'camera',
    status: 'available',
    badges: ['Nur Inferenz', 'Camera'],
  },
  {
    id: 'audio-recognition',
    name: 'Audioerkennung',
    description: 'Geräusche oder Sprache werden aufgenommen und klassifiziert.',
    image: imgAudio,
    requiresTraining: true,
    inputModality: 'microphone',
    interactionType: 'classification',
    bleCapable: true,
    effortLevel: 'Medium',
    defaultInferenceSource: 'microphone',
    status: 'planned',
    badges: ['Trainierbar', 'Audio'],
  },
];

export function getAvailableTaskModels () {
  return TASK_MODELS;
}
