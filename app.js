#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const DATA_FILE = path.join(__dirname, 'data.json');

function nowISO() { return new Date().toISOString(); }
function gerarId(prefix='') { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
function parseDateInput(input) { const dt = new Date(input); return isNaN(dt) ? null : dt; }
function limparCPF(cpf) { return (cpf||'').replace(/\D/g,''); }
function validarEmail(email) { return /.+@.+\..+/.test(email); }

// -------------------------------------------------------------------------
class Reserva {
  constructor(o){
    this.id = o.id || gerarId('res_');
    this.clienteId = o.clienteId;
    this.quartoNome = o.quartoNome;
    this.status = o.status || 'pendente'; // pendente, adiada, realizada, cancelada
    this.checkIn = o.checkIn;
    this.checkOut = o.checkOut;
    this.avaliacao = o.avaliacao || null; // {nota, comentario}
  }
}

class Funcionario {
  constructor(o){
    this.id = o.id || gerarId('fun_');
    this.username = o.username;
    this.cpf = limparCPF(o.cpf);
    this.email = o.email;
    this.senha = o.senha;
  }
}

class Cliente {
  constructor(o){
    this.id = o.id || gerarId('cli_');
    this.nome = o.nome;
    this.dataNascimento = o.dataNascimento;
    this.cpf = limparCPF(o.cpf);
    this.email = o.email;
    this.senha = o.senha;
  }
}

class Quartos {
  constructor(o){
    this.id = o.id || gerarId('qua_');
    this.nome = o.nome;
    this.descricao = o.descricao;
    this.qtdCamas = o.qtdCamas;
    this.precoPorNoite = o.precoPorNoite;
    this.qtdDisponivel = o.qtdDisponivel;
  }
}

class Sistema {
  constructor(){ this.clientes=[]; this.funcionarios=[]; this.quartos=[]; this.reservas=[]; }

  static carregar(){
    if(fs.existsSync(DATA_FILE)){
      const raw = fs.readFileSync(DATA_FILE,'utf-8');
      const d = JSON.parse(raw);
      const s = new Sistema();
      s.clientes = (d.clientes||[]).map(x=>new Cliente(x));
      s.funcionarios = (d.funcionarios||[]).map(x=>new Funcionario(x));
      s.quartos = (d.quartos||[]).map(x=>new Quartos(x));
      s.reservas = (d.reservas||[]).map(x=>new Reserva(x));
      return s;
    }
    return new Sistema();
  }

  salvar(){ fs.writeFileSync(DATA_FILE, JSON.stringify(this,null,2)); }

  // Clientes & Funcionarios ------------------------------------------------
  cadastrarCliente(d){ const c = new Cliente(d); this.clientes.push(c); this.salvar(); return c; }
  autenticarCliente(email,senha){ return this.clientes.find(c=> (c.email===email||c.cpf===email) && c.senha===senha); }

  cadastrarFuncionario(d){ const f=new Funcionario(d); this.funcionarios.push(f); this.salvar(); return f; }
  autenticarFuncionario(user,senha){ return this.funcionarios.find(f=>(f.username===user||f.email===user)&&f.senha===senha); }

  // Quartos ----------------------------------------------------------------
  cadastrarQuarto(d){ const q=new Quartos(d); this.quartos.push(q); this.salvar(); return q; }
  editarQuarto(nome,d){ const q=this.quartos.find(q=>q.nome===nome); if(!q) return null; Object.assign(q,d); this.salvar(); return q; }
  excluirQuarto(nome){ this.quartos=this.quartos.filter(q=>q.nome!==nome); this.salvar(); }

  // Reservas ---------------------------------------------------------------
  criarReserva(d){ const r=new Reserva(d); this.reservas.push(r); this.salvar(); return r; }
  cancelarReserva(id){ const r=this.reservas.find(r=>r.id===id); if(r) r.status='cancelada'; this.salvar(); return r; }
  mudarStatusReserva(id,status){ const r=this.reservas.find(r=>r.id===id); if(r) r.status=status; this.salvar(); return r; }
  avaliarReserva(id,avaliacao){ const r=this.reservas.find(r=>r.id===id); if(r) r.avaliacao=avaliacao; this.salvar(); return r; }
}

// CLI ---------------------------------------------------------------------
class CLI {
  constructor(s){ this.sistema=s; this.rl=readline.createInterface({input:process.stdin,output:process.stdout}); }
  perguntar(q){ return new Promise(res=>this.rl.question(q,a=>res(a.trim()))); }

  async menuPrincipal(){
    console.log("1. Login\n2. Cadastro\n3. Sair");
    const op=await this.perguntar("> ");
    if(op==='1') return this.login();
    if(op==='2') return this.cadastro();
    if(op==='3') return this.rl.close();
    return this.menuPrincipal();
  }

  async login(){
    const tipo=await this.perguntar("Cliente (c) ou Funcionario (f)? ");
    const user=await this.perguntar("Email/CPF/Username: ");
    const senha=await this.perguntar("Senha: ");
    if(tipo==='c'){
      const cli=this.sistema.autenticarCliente(user,senha);
      if(cli) return this.menuCliente(cli);
    } else {
      const fun=this.sistema.autenticarFuncionario(user,senha);
      if(fun) return this.menuFuncionario(fun);
    }
    console.log("Login inválido");
    return this.menuPrincipal();
  }

  async cadastro(){
    const tipo=await this.perguntar("Cadastrar Cliente (c) ou Funcionario (f)? ");
    if(tipo==='c'){
      const nome=await this.perguntar("Nome: ");
      const dataNascimento=await this.perguntar("Nascimento: ");
      const cpf=await this.perguntar("CPF: ");
      const email=await this.perguntar("Email: ");
      const senha=await this.perguntar("Senha: ");
      this.sistema.cadastrarCliente({nome,dataNascimento,cpf,email,senha});
    } else {
      const username=await this.perguntar("Username: ");
      const cpf=await this.perguntar("CPF: ");
      const email=await this.perguntar("Email: ");
      const senha=await this.perguntar("Senha: ");
      this.sistema.cadastrarFuncionario({username,cpf,email,senha});
    }
    return this.menuPrincipal();
  }

  async menuFuncionario(fun){
    console.log("\nFuncionario:");
    console.log("4.Ver meus dados\n5.Ver reservas\n6.Ver quartos\n7.Ver clientes\n8.Mudar status reserva\n9.Adicionar quarto\n10.Editar quarto\n11.Excluir quarto\n12.Sair");
    const op=await this.perguntar("> ");
    switch(op){
      case '4': console.log(fun); break;
      case '5': console.log(this.sistema.reservas); break;
      case '6': console.log(this.sistema.quartos); break;
      case '7': console.log(this.sistema.clientes); break;
      case '8': {const id=await this.perguntar("ID: "); const st=await this.perguntar("Novo status: "); this.sistema.mudarStatusReserva(id,st); break;}
      case '9': {const nome=await this.perguntar("Nome quarto: "); const descricao=await this.perguntar("Desc: "); const qtdCamas=await this.perguntar("Camas: "); const precoPorNoite=await this.perguntar("Preço: "); const qtdDisponivel=await this.perguntar("Qtd: "); this.sistema.cadastrarQuarto({nome,descricao,qtdCamas,precoPorNoite,qtdDisponivel}); break;}
      case '10': {const nome=await this.perguntar("Nome quarto: "); const desc=await this.perguntar("Nova desc: "); this.sistema.editarQuarto(nome,{descricao:desc}); break;}
      case '11': {const nome=await this.perguntar("Nome quarto: "); this.sistema.excluirQuarto(nome); break;}
      case '12': return this.menuPrincipal();
    }
    return this.menuFuncionario(fun);
  }

  async menuCliente(cli){
    console.log("\nCliente:");
    console.log("1.Ver meus dados\n2.Ver quartos\n3.Fazer reserva\n4.Cancelar reserva\n5.Minhas reservas\n6.Avaliar estadia\n7.Sair");
    const op=await this.perguntar("> ");
    switch(op){
      case '1': console.log(cli); break;
      case '2': console.log(this.sistema.quartos); break;
      case '3': {const quartoNome=await this.perguntar("Quarto: "); const checkIn=await this.perguntar("Check-in: "); const checkOut=await this.perguntar("Check-out: "); this.sistema.criarReserva({clienteId:cli.id,quartoNome,checkIn,checkOut}); break;}
      case '4': {const id=await this.perguntar("ID reserva: "); this.sistema.cancelarReserva(id); break;}
      case '5': console.log(this.sistema.reservas.filter(r=>r.clienteId===cli.id)); break;
      case '6': {const id=await this.perguntar("ID reserva: "); const nota=await this.perguntar("Nota: "); const comentario=await this.perguntar("Comentário: "); this.sistema.avaliarReserva(id,{nota,comentario}); break;}
      case '7': return this.menuPrincipal();
    }
    return this.menuCliente(cli);
  }
}

(async()=>{ const sistema=Sistema.carregar(); const cli=new CLI(sistema); await cli.menuPrincipal(); })();