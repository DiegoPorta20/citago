import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { ServiceOrmEntity } from '../../../../../catalog/infrastructure/persistence/typeorm/entities/service.orm-entity.js';
import { SaleOrmEntity } from './sale.orm-entity.js';

/**
 * One charged item of a sale.
 *
 * `description`, `unit_price` and `line_total` are snapshots (rule SA-7):
 * `service_id` is kept for reporting, but nothing on the line is read back from
 * the catalogue. Lines are written once and never updated.
 */
@Entity('sale_lines')
@Index('ix_sale_lines_sale', ['tenantId', 'saleId', 'position'])
export class SaleLineOrmEntity {
  @PrimaryColumn({ name: 'id', type: 'char', length: 36 })
  id: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId: string;

  @Column({ name: 'sale_id', type: 'char', length: 36 })
  saleId: string;

  @Column({ name: 'service_id', type: 'char', length: 36, nullable: true })
  serviceId: string | null;

  @Column({ name: 'description', type: 'varchar', length: 160 })
  description: string;

  @Column({ name: 'unit_price', type: 'decimal', precision: 12, scale: 2 })
  unitPrice: string;

  @Column({ name: 'quantity', type: 'smallint', unsigned: true })
  quantity: number;

  @Column({ name: 'line_total', type: 'decimal', precision: 12, scale: 2 })
  lineTotal: string;

  /** Keeps the lines in the order they were charged. */
  @Column({ name: 'position', type: 'smallint', unsigned: true })
  position: number;

  @ManyToOne(() => SaleOrmEntity, {
    onDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn([
    {
      name: 'tenant_id',
      referencedColumnName: 'tenantId',
      foreignKeyConstraintName: 'fk_sale_lines_sale',
    },
    { name: 'sale_id', referencedColumnName: 'id' },
  ])
  sale?: SaleOrmEntity;

  @ManyToOne(() => ServiceOrmEntity, {
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn([
    {
      name: 'tenant_id',
      referencedColumnName: 'tenantId',
      foreignKeyConstraintName: 'fk_sale_lines_service',
    },
    { name: 'service_id', referencedColumnName: 'id' },
  ])
  service?: ServiceOrmEntity;
}
