'use strict';

// Replaces the old is_featured boolean with a configurable tag (see
// product_featured_tags, added in the previous migration). is_featured
// itself is left in place, unused — dropping it isn't necessary and keeps
// this change non-destructive/reversible.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('products', 'featured_tag_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'product_featured_tags',
        key: 'id'
      },
      onDelete: 'SET NULL'
    });
    await queryInterface.addIndex('products', ['featured_tag_id']);
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('products', 'featured_tag_id');
  }
};
