'use strict';

module.exports = {
  up: async (queryInterface) => {
    const categories = await queryInterface.sequelize.query(
      `SELECT id, name FROM categories WHERE name IN ('Dining Furniture', 'Beds & Mattresses');`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    const categoryId = Object.fromEntries(categories.map((c) => [c.name, c.id]));

    const now = new Date();

    await queryInterface.bulkInsert('products', [
      {
        sku: 'CSC2605288DT',
        name: 'Extendable Dining Table (1800-2600mm)',
        brand: 'Calvaro',
        category_id: categoryId['Dining Furniture'],
        short_description:
          'Extendable dining table with sintered stone top',
        description:
          'Extendable dining table with sintered stone top. Dimensions: 1800(+400+400)x900x750mm (extends from 1800 to 2600mm). Variant: Sintered Stone Y018 top + Black Sanding Powder Coat Frame/Leg. CBM per unit: 0.510.',
        price: 1299.0,
        sale_price: null,
        stock_qty: 10,
        weight_kg: null,
        tags: ['dining table', 'extendable', 'sintered stone', 'powder coat'],
        image_filenames: ['CSC2605288DT.png'],
        is_featured: false,
        is_active: true,
        created_at: now,
        updated_at: now
      },
      {
        sku: 'CYL06-I160',
        name: 'Yoga Bed (1800x2000mm)',
        brand: 'Lunor',
        category_id: categoryId['Beds & Mattresses'],
        short_description:
          'Smart yoga bed with 12-motor system, back/leg adjustment, and TPEE comfort layer',
        description:
          'Yoga bed, 1800x2000mm (split design). Features: back adjustment, leg adjustment, TV-position lumbar support, abdominal pressure relief, yoga mode. Configuration: 12 motors (OKIN), sleep-aid vibration massage, wireless remote control, TPEE comfort layer, induction night light.',
        price: 3599.0,
        sale_price: null,
        stock_qty: 5,
        weight_kg: null,
        tags: [
          'yoga bed',
          'smart bed',
          'adjustable bed',
          '12 motor',
          'OKIN',
          'TPEE',
          'Lunor'
        ],
        image_filenames: ['CYL06-I160.png'],
        is_featured: true,
        is_active: true,
        created_at: now,
        updated_at: now
      },
      {
        sku: 'CYL06-N935',
        name: 'Lumbar Support Mattress (1500x2000mm)',
        brand: 'Lunor',
        category_id: categoryId['Beds & Mattresses'],
        short_description:
          'Smart lumbar support mattress with 3-motor system and latex comfort layer',
        description:
          'Lumbar support mattress, 1500x2000mm. Features: back adjustment, leg adjustment, lumbar support, split back. Configuration: 3 motors (OKIN), sleep-aid vibration massage, wireless remote control, latex comfort layer, induction night light.',
        price: 2199.0,
        sale_price: null,
        stock_qty: 8,
        weight_kg: null,
        tags: [
          'mattress',
          'lumbar support',
          'smart mattress',
          '3 motor',
          'OKIN',
          'latex',
          'Lunor'
        ],
        image_filenames: ['CYL06-N935.png'],
        is_featured: false,
        is_active: true,
        created_at: now,
        updated_at: now
      },
      {
        sku: 'CYL06-RB01-R',
        name: 'Rotating Bed (1000x2000mm, Right Rotation)',
        brand: 'Lunor',
        category_id: categoryId['Beds & Mattresses'],
        short_description:
          'Rotating bed with right-rotation entry/exit, 4-motor system, and tech leather backrest',
        description:
          'Rotating bed, 1000x2000mm. Features: back adjustment, leg adjustment, rotating entry/exit (right rotation). Configuration: 4 motors (OKIN), armrests, armrest covers, backrest (tech leather), wireless remote control, sponge mattress, induction night light.',
        price: 2899.0,
        sale_price: null,
        stock_qty: 6,
        weight_kg: null,
        tags: [
          'rotating bed',
          'smart bed',
          'adjustable bed',
          '4 motor',
          'OKIN',
          'tech leather',
          'Lunor'
        ],
        image_filenames: ['CYL06-RB01-R.png'],
        is_featured: false,
        is_active: true,
        created_at: now,
        updated_at: now
      },
      {
        sku: 'CYL06-T300',
        name: 'Turning Care Bed (1050x2000mm)',
        brand: 'Lunor',
        category_id: categoryId['Beds & Mattresses'],
        short_description:
          'Rotating bed with right-rotation entry/exit, 4-motor system, and tech leather backrest',
        description:
          'Turning care bed, 1050x2000mm. Bed surface width: 1050mm. Motor: OKIN, wireless control. Casters: 4-inch single-row iron hub plastic brake casters (Yajie). Headboard: beech wood frame + 25mm multi-layer solid wood panel, paint-free veneer. Footboard: beech wood frame + 25mm multi-layer solid wood panel, paint-free veneer. Guardrails: fully enclosed wooden guardrails. Mattress: 9cm TPEE mattress, includes guardrail cover.',
        price: 3299.0,
        sale_price: null,
        stock_qty: 4,
        weight_kg: null,
        tags: [
          'care bed',
          'nursing bed',
          'turning bed',
          'OKIN',
          'wooden guardrail',
          'TPEE',
          'Lunor'
        ],
        image_filenames: ['CYL06-T300.png'],
        is_featured: false,
        is_active: true,
        created_at: now,
        updated_at: now
      },
      {
        sku: 'CYL06-Server',
        name: 'Saihui Walker (Medium)',
        brand: 'Lunor',
        category_id: categoryId['Beds & Mattresses'],
        short_description:
          'Medium-size mobility walker with 150kg load capacity, brake casters, and shopping basket',
        description:
          'Saihui walker, medium size. Load capacity: 150kg. Dimensions (LxWxH): medium - 60x68x66-86cm; large - 60x68x74-102cm. Seat height: medium - 55cm, large - 62cm. Seat width: 46cm. Caster size: 200x35mm. Product weight: medium - 7.0kg, large - 7.1kg (includes shopping basket weight 300g).',
        price: 249.0,
        sale_price: null,
        stock_qty: 15,
        weight_kg: 7.0,
        tags: ['walker', 'mobility aid', 'saihui', 'brake casters', 'Lunor'],
        image_filenames: ['CYL06-Server.png'],
        is_featured: false,
        is_active: true,
        created_at: now,
        updated_at: now
      }
    ]);
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('products', {
      sku: [
        'CSC2605288DT',
        'CYL06-I160',
        'CYL06-N935',
        'CYL06-RB01-R',
        'CYL06-T300',
        'CYL06-Server'
      ]
    });
  }
};
