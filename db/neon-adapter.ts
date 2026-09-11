import {getSql} from "./neon";

type QueryRow=Record<string,unknown>;

function postgresQuery(query:string){
  let index=0;
  return query.replace(/\?/g,()=>`$${++index}`)
    .replace(/INSERT OR IGNORE INTO/gi,"INSERT INTO")
    .replace(/ ON CONFLICT\([^)]*\) DO UPDATE SET /gi,match=>match);
}

class NeonStatement{
  constructor(private readonly query:string,private readonly values:unknown[]=[]){ }
  bind(...values:unknown[]){return new NeonStatement(this.query,values)}
  async all<T extends QueryRow=QueryRow>(){
    const rows=await getSql().query(postgresQuery(this.query),this.values) as T[];
    return{results:rows};
  }
  async first<T extends QueryRow=QueryRow>(){
    const rows=await getSql().query(postgresQuery(this.query),this.values) as T[];
    return rows[0]??null;
  }
  async run(){
    const rows=await getSql().query(postgresQuery(this.query),this.values);
    return{success:true,results:rows};
  }
}

export type PreparedNeonStatement=NeonStatement;

export function getDatabase(){
  return{
    prepare(query:string){return new NeonStatement(query)},
    async batch(statements:NeonStatement[]){return Promise.all(statements.map(statement=>statement.run()))},
  };
}
