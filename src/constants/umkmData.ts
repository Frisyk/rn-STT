export interface UMKM {
  id: string;
  name: string;
  category: 'Kuliner' | 'Kafe' | 'Sembako' | 'Jasa';
  description: string;
  address: string;
  phone: string;
  rating: number;
  latitude: number;
  longitude: number;
  imageUrl: string;
}

export const UMKM_LIST: UMKM[] = [
  {
    id: '1',
    name: 'Nasi Goreng Gila Monas',
    category: 'Kuliner',
    description: 'Nasi goreng gila legendaris dengan porsi melimpah, sosis, bakso, dan bumbu rempah khas yang pedas manis mantap.',
    address: 'Jl. Silang Monas Timur No.1, Gambir, Jakarta Pusat',
    phone: '0812-3456-7890',
    rating: 4.8,
    latitude: -6.1765,
    longitude: 106.8280,
    imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=60',
  },
  {
    id: '2',
    name: 'Kopi Kenangan Senja',
    category: 'Kafe',
    description: 'Tempat ngopi santai dengan berbagai varian kopi susu gula aren dan camilan kekinian yang ramah di kantong.',
    address: 'Jl. Kebon Sirih No.45, Menteng, Jakarta Pusat',
    phone: '0821-9876-5432',
    rating: 4.5,
    latitude: -6.1820,
    longitude: 106.8295,
    imageUrl: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=500&auto=format&fit=crop&q=60',
  },
  {
    id: '3',
    name: 'Toko Kelontong Madura Berkah',
    category: 'Sembako',
    description: 'Menyediakan kebutuhan pokok lengkap 24 jam dengan pelayanan ramah dan harga bersaing.',
    address: 'Jl. Jaksa No.12, Kebon Sirih, Jakarta Pusat',
    phone: '0857-1111-2222',
    rating: 4.6,
    latitude: -6.1852,
    longitude: 106.8270,
    imageUrl: 'https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?w=500&auto=format&fit=crop&q=60',
  },
  {
    id: '4',
    name: 'Salon Cantika Estetika',
    category: 'Jasa',
    description: 'Jasa potong rambut, perawatan wajah, dan spa keluarga profesional dengan protokol kebersihan terjamin.',
    address: 'Jl. Thamrin Boulevard No.8, Kebon Melati, Jakarta Pusat',
    phone: '0813-8888-9999',
    rating: 4.7,
    latitude: -6.1910,
    longitude: 106.8220,
    imageUrl: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=500&auto=format&fit=crop&q=60',
  },
  {
    id: '5',
    name: 'Bakso Mas Kumis',
    category: 'Kuliner',
    description: 'Bakso urat sapi asli dengan kuah kaldu super gurih dan tetelan melimpah yang menggugah selera.',
    address: 'Jl. KH. Wahid Hasyim No.98, Menteng, Jakarta Pusat',
    phone: '0878-5555-6666',
    rating: 4.9,
    latitude: -6.1875,
    longitude: 106.8320,
    imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=500&auto=format&fit=crop&q=60',
  }
];
