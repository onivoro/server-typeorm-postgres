import { DataSource } from 'typeorm';
import { dataSourceConfigFactory } from './data-source-config-factory.function';

export const dataSourceFactory = (
  name: string,
  options: {
    database: string,
    host: string,
    port: string,
    username: string,
    password: string,
    synchronize?: boolean
  },
  entities: any[]
) =>
  new DataSource(dataSourceConfigFactory(name, options, entities));
