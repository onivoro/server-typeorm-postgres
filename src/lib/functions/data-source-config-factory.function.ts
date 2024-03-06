import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { IDataSourceOptions } from '../types/data-source-options.interface';

export function dataSourceConfigFactory(
  name: string,
  options: IDataSourceOptions,
  entities: any[]
): PostgresConnectionOptions {

  const {
    database, host, password, port, username, synchronize=false, logging=false
  } = options;

  const config: PostgresConnectionOptions = {
    name,
    autoLoadEntities: true,
    type: 'postgres',
    host,
    port,
    username,
    password,
    database,
    synchronize,
    logging,
    entities,
    subscribers: [],
    migrations: [],
    namingStrategy: new SnakeNamingStrategy(),
  } as any;

  return config;
}
