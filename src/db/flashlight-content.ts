/** Website copy for FlashLight Photography, the first studio on this platform. */

export const FLASH_SLUG = 'flashlight';

export const FLASH_STUDIO = {
    name: 'FlashLight Photography',
    tagline: 'Only Some Moments Become Memories',
    email: 'hello@flashlightphotography.com',
    phone: '+91 98765 43210',
    whatsapp: '+91 98765 43210',
    address: '12 FlashLight Studio Avenue, Creative District',
    city: 'Chennai',
    mapUrl: '',
    hours: 'Monday – Saturday: 10:00 AM – 8:00 PM (By Appointment)',
    about: 'We are a dedicated collective of photographers, visual artists, and album designers passionate about storytelling through light. We collaborate closely with you through pre-event planning, capturing timeless candids and portraits, and delivering your complete collection via private interactive online galleries with instant guest sharing.',
    gstin: '',
    instagram: 'https://instagram.com',
    facebook: 'https://facebook.com',
    youtube: 'https://youtube.com',
};

export const FLASH_WEBSITE = {
    bannerActive: true,
    bannerDiscount: '10% OFF',
    bannerText: 'Bookings Open! Enjoy an exclusive 10% discount on all Wedding & Milestone packages',
    couponCode: 'WELCOME10',
    heroSubtitle: 'Some things were never meant to trend for a week but to endure for years ahead. Photography and videography across every wedding, celebration, portrait, and brand campaign.',
    historyText: 'Established in 2014, FlashLight Photography was born out of a desire to create photographs that endure for years ahead. What began as an intimate boutique portrait atelier has grown into an acclaimed visual production house trusted by hundreds of families, couples, and creative brands.',
    whyChooseUs: [
        'Instant Live QR Event Galleries — Guests view & download high-res photos in real time',
        'Full Master High-Resolution Digital Rights Included with Every Package',
        'Handcrafted Flush-Mount Archival Albums with Layflat Panoramic Spreads',
        'Dedicated Dual-Photographer Coverage (Candid Documentary + Portraiture)',
        'Transparent Pricing with Taxes Included & 24-Hour Availability Confirmation',
    ],
    slides: [
        {
            id: '1',
            image: '/images/hero-couple-petals.jpg',
            imageUrl: '/images/hero-couple-petals.jpg',
            title: 'Only some moments',
            highlightText: 'become memories...',
            subtitle: 'Some things were never meant to trend for a week but to endure for years ahead. Photography and videography across every wedding, celebration, portrait, and brand campaign.',
            tag: 'Wedding & Grand Celebrations',
            lens: '85mm f/1.4 GM',
            shutter: '1/500s',
            iso: 'ISO 100',
        },
        {
            id: '2',
            image: '/images/hero-couple-outdoor.jpg',
            imageUrl: '/images/hero-couple-outdoor.jpg',
            title: 'Authentic Romance &',
            highlightText: 'candid chemistry...',
            subtitle: 'Scenic destination sessions, natural romance, and cinematic compositions crafted to endure generations.',
            tag: 'Couples',
            lens: '70-200mm f/2.8 GM II',
            shutter: '1/320s',
            iso: 'ISO 200',
        },
        {
            id: '3',
            image: '/images/login-showcase-1.jpg',
            imageUrl: '/images/login-showcase-1.jpg',
            title: 'Stories Told in Light,',
            highlightText: 'cherished forever...',
            subtitle: 'Capturing weddings, portraits, and milestones with instant live QR guest galleries, master downloads, and handcrafted archival albums.',
            tag: 'Milestones',
            lens: '50mm f/1.2 GM',
            shutter: '1/400s',
            iso: 'ISO 160',
        },
    ],
    products: [
        {
            id: 'album-flushmount',
            name: 'Handcrafted Flush-Mount Archival Album',
            category: 'Albums',
            price: 1499900,
            description: 'Heirloom-grade seamless layflat album featuring Italian vegan leather, crystal-clear UV pages, and custom laser cover embossing.',
            features: ['Seamless 180° panoramic spreads', 'Choice of 12 cover colors & embossing', 'Anti-scratch archival UV page lamination', 'Handcrafted presentation wood box'],
            image: '/images/login-showcase-1.jpg',
        },
        {
            id: 'canvas-gallery',
            name: 'Museum Fine-Art Canvas Wraps',
            category: 'Wall Art',
            price: 299900,
            description: 'Museum-grade heavy cotton canvas hand-stretched across kiln-dried pine wood with a protective satin sealant.',
            features: ['Vibrant 12-color archival pigment inks', '1.5-inch solid hardwood depth', 'Pre-installed steel hanging hardware', 'Lifetime colorfastness guarantee'],
            image: '/images/login-showcase-2.jpg',
        },
        {
            id: 'frame-hardwood',
            name: 'Handcrafted Hardwood Gallery Frames',
            category: 'Frames',
            price: 149900,
            description: 'Solid teak or oak wood frames custom fitted with acid-free 4-ply matting and anti-reflective museum acrylic glass.',
            features: ['Precision-cut acid-free conservation mat', 'Shatter-resistant museum acrylic', 'Durable Kraft dust cover backing', 'Available in Matte Black, Oak & Walnut'],
            image: '/images/login-showcase-1.jpg',
        },
        {
            id: 'usb-keepsake',
            name: 'Engraved Wooden Keepsake & USB Box',
            category: 'Keepsakes',
            price: 79900,
            description: 'Slide-top walnut wood presentation box containing a custom engraved 64GB high-speed USB 3.0 flash drive and sample prints.',
            features: ['64GB High-speed USB 3.0 flash drive', 'Includes 25 selected 4x6 fine-art prints', 'Custom laser-engraved with your initials', 'Protective magnetic closure'],
            image: '/images/login-showcase-2.jpg',
        },
    ],
};

export const FLASH_SERVICES = [
    { slug: 'wedding-photography', name: 'Wedding Photography & Cinematography', summary: 'Comprehensive documentary and portrait coverage for your wedding celebrations.', description: 'From pre-wedding ceremonies to reception highlights, our team preserves each meaningful glance, heartfelt ritual, and joyful moment with cinematic artistry and unobtrusive documentary coverage.', icon: 'camera', base: 7500000, sort: 1 },
    { slug: 'birthday-events', name: 'Birthday & Milestone Celebrations', summary: 'Vibrant event photography for birthdays, anniversaries, and personal milestones.', description: 'Capture the laughter, cake cutting, dynamic candids, and family gatherings with instant guest QR photo delivery and fast digital turnaround.', icon: 'sparkles', base: 1500000, sort: 2 },
    { slug: 'housewarming', name: 'Housewarming (Griha Pravesh) Ceremony', summary: 'Sacred rituals, festive atmosphere, and warm portraits in your new home.', description: 'Documenting the traditional pooja rituals, joyous welcome of friends and family, architectural home details, and group portraits for your new beginning.', icon: 'heart', base: 1800000, sort: 3 },
    { slug: 'pre-wedding', name: 'Pre-Wedding & Couple Sessions', summary: 'Story-driven couple portrait sessions celebrating your unique journey together.', description: 'Custom-tailored outdoor and architectural portrait sessions designed to reflect your personal romance in picturesque natural or urban settings.', icon: 'heart', base: 2500000, sort: 4 },
    { slug: 'maternity-baby', name: 'Maternity & Baby Showers', summary: 'Tender maternity portraits and joyful baby shower celebrations.', description: 'Preserving the radiant anticipation of welcoming a new child with gentle lighting, creative styling, and heartfelt family moments.', icon: 'heart', base: 1600000, sort: 5 },
    { slug: 'corporate-events', name: 'Corporate & Commercial Shoots', summary: 'Executive portraits, brand launches, symposiums, and company galas.', description: 'High-impact professional photography delivering on-brand visual assets, live conference sharing, and studio-grade executive headshots.', icon: 'camera', base: 2000000, sort: 6 },
];

export const FLASH_PACKAGES = [
    { serviceSlug: 'wedding-photography', slug: 'wedding-silver', name: 'Wedding Silver Collection', description: 'Essential single-day wedding coverage featuring edited digital delivery and live online guest gallery.', price: 7500000, photos: 400, digital: true, album: false, hours: 8, featured: false, sort: 1, features: ['1 Senior Lead Photographer', '8 Hours of Continuous Coverage', '400+ Curated & Retouched Photographs', 'Instant Live QR Guest Gallery', 'Master High-Resolution Digital Downloads'] },
    { serviceSlug: 'wedding-photography', slug: 'wedding-gold', name: 'Wedding Gold Collection', description: 'Our most sought-after full-day package with two photographers and a handcrafted flush-mount album.', price: 12500000, photos: 800, digital: true, album: true, hours: 12, featured: true, sort: 2, features: ['2 Senior Photographers (Candid + Traditional)', 'Full-Day Comprehensive Coverage (12 Hours)', '800+ Master Retouched Photographs', 'Live Event QR Gallery for Instant Guest Access', '40-Page Handcrafted Archival Album', 'Complete High-Resolution Digital Master Collection'] },
    { serviceSlug: 'wedding-photography', slug: 'wedding-platinum', name: 'Wedding Platinum Legacy', description: 'Multi-day grand celebration package with aerial cinematography and twin heirloom albums.', price: 20000000, photos: 1500, digital: true, album: true, hours: 24, featured: false, sort: 3, features: ['3 Senior Photographers + Drone Aerial Visuals', 'Two Full Days of Extensive Coverage (24 Hours)', '1,500+ Master Retouched High-Resolution Files', 'Live QR Gallery with Real-Time Event Sync', 'Two Handcrafted Archival Leather Albums', 'Same-Day Digital Highlight Reel'] },
];

export const FLASH_PORTFOLIO = [
    { title: 'Muhurtham & Sacred Garlands at Sri Venkateswara Mandapam', category: 'Weddings', description: 'Traditional flower garland exchange amidst sacred chanting and blessings.', image: '/images/weddingphoto2.jpg', featured: true, sort: 1 },
    { title: 'Sunset Oorvalam & Kasi Yatra Rituals', category: 'Weddings', description: 'Sacred procession under the evening sky surrounded by joyous elders and family.', image: '/images/weddingphoto1.jpg', featured: true, sort: 2 },
    { title: 'Golden Marigold Celebration & Joyous Family Candids', category: 'Candid Moments', description: 'Heartwarming laughter and genuine smiles adorned with fresh yellow marigold strands.', image: '/images/hero-wedding-garlands.jpg', featured: true, sort: 3 },
    { title: 'Crimson Rose Petals & Heritage Serenade', category: 'Couples', description: 'An editorial overhead perspective framing the bride and groom in delicate floral symmetry.', image: '/images/hero-couple-petals.jpg', featured: true, sort: 4 },
    { title: 'Architectural Destination Pre-Wedding Shoot', category: 'Couples', description: 'Intimate candid romance framed against historic South Indian temple pillars and courtyard.', image: '/images/hero-couple-outdoor.jpg', featured: true, sort: 5 },
    { title: 'The Royal Mahabalipuram Wedding Highlight Film', category: 'Wedding Films', description: 'A 4K cinematic film capturing the rhythmic beats of nadaswaram, sacred thali moments, and evening vows.', image: '/images/weddingphoto2.jpg', featured: true, sort: 6 },
    { title: 'Spontaneous Laughter & Saptapadi Joy', category: 'Candid Moments', description: 'Unposed, heartfelt laughter between cousins and friends following the muhurtham rituals.', image: '/images/weddingphoto3.jfif', featured: true, sort: 7 },
    { title: 'Sacred Griha Pravesh & Traditional Vilakku Pooja', category: 'Candid Moments', description: 'Blessing the new threshold with brass lamps, auspicious prayers, and family togetherness.', image: '/images/house warming.jfif', featured: true, sort: 8 },
];

export const FLASH_TESTIMONIALS = [
    { name: 'Priya & Rahul', event: 'Wedding Celebration', quote: 'Having the live QR gallery at our reception was an incredible hit! Our guests were able to see and download pictures in real time, and the quality of the final album exceeded our expectations.', rating: 5, sort: 1 },
    { name: 'Ananya Deshmukh', event: 'Family Portrait Session', quote: 'The team made our entire family feel comfortable from minute one. The lighting, candids, and attention to detail were world-class. We will treasure these portraits forever.', rating: 5, sort: 2 },
    { name: 'Karthik Ramanathan', event: 'Corporate Gala & Brand Launch', quote: 'Exceptionally professional execution and punctual delivery. The live event gallery allowed our attendees to immediately post highlights on social media with studio-quality imagery.', rating: 5, sort: 3 },
];
