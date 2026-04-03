import { initializeApp } from 'firebase/app'
import { getFirestore, doc, setDoc } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyD7ImWnSeSb3DTuyXTnS55gRsqkBZZv5q8",
  authDomain: "clientes-admin-a2258.firebaseapp.com",
  projectId: "clientes-admin-a2258",
  storageBucket: "clientes-admin-a2258.firebasestorage.app",
  messagingSenderId: "598293541730",
  appId: "1:598293541730:web:bdee1e314b46e5fa9ff23b"
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

const cardapioData = [
  {
    "id": "entradas", "label": "Entradas",
    "categorias": [
      {
        "titulo": "Para Começar",
        "itens": [
          { "nome": "Pão Rústico com Manteiga", "desc": "Pão rústico de longa fermentação e manteiga de ervas", "preco": 15 },
          { "nome": "Pão do Pedro", "desc": "Pão caseiro e manteiga de ervas", "preco": 12 },
          { "nome": "Berinjela da Vó Elvira", "desc": "Acompanha pão do rústico", "preco": 18 },
          { "nome": "Mix de Castanhas", "desc": "Nozes, castanha-de-caju e castanha-do-pará", "preco": 15 }
        ]
      },
      {
        "titulo": "Entradas para Compartilhar",
        "itens": [
          { "nome": "Porpeta da Vó Marieta", "desc": "Tradição da Calábria, preparada com frango desfiado, pão ralado e queijo. Uma receita rara de Cosenza, que era servida apenas no Carnaval — 5 unidades", "preco": 29 },
          { "nome": "Ceviche de Salmão", "desc": "Cubos de salmão marinados, manga, abacate e cebola roxa, envolvidos em molho cítrico de limão-siciliano, gergelim preto e salsa. Acompanha chips de batata-doce", "preco": 69 },
          { "nome": "Salmão Gravilax", "desc": "Finas fatias de salmão curado em sal grosso, açúcar mascavo, endro e especiarias, servidas sobre rúcula fresca, amêndoas tostadas e coalhada cremosa. Finalizado com molho de mostarda Dijon e pão rústico", "preco": 72 },
          { "nome": "Casquinha de Siri da Vó Ione", "desc": "Preparada à moda da Vó Ione, com carne de siri delicadamente refogada em especiarias selecionadas. Servida individualmente", "preco": 29 },
          { "nome": "Steak Tartare", "desc": "Cubos de mignon Angus picados na ponta da faca e delicadamente temperados. Acompanhados de batata Anna, salsa fresca e azeite extravirgem", "preco": 69 },
          { "nome": "Alcachofra & Burrata", "desc": "Corações de alcachofra marinados, servidos sobre rúcula fresca e burrata cremosa. Finalizados com toque cítrico de limão-siciliano, amêndoas laminadas, tomates-cereja e azeite extravirgem. Acompanha pão rústico e molho pesto", "preco": 75 },
          { "nome": "Carpaccio Clássico", "desc": "Finas lâminas de lagarto Black Angus servidas com molho cremoso de mostarda Dijon, parmesão ralado, rúcula fresca e alcaparras. Acompanha pão rústico", "preco": 69 },
          { "nome": "Burrata Marieta", "desc": "Uma releitura ousada da clássica burrata empanada em panko para uma crocância impecável, servida sobre um ragù de linguiça artesanal. Acompanha pão do Pedro", "preco": 69 },
          { "nome": "Tábua de Frios", "desc": "Seleção especial com Presunto de Parma de longa maturação, salame hamburguês, muçarela de búfala, lascas de parmesão, queijo de mofo azul e queijo brie. Finalizada com castanhas, azeitonas pretas e geleia de frutas. Acompanha pão rústico", "preco": 140 }
        ]
      },
      {
        "titulo": "Saladas para Compartilhar",
        "itens": [
          { "nome": "Ucelli", "desc": "Folhas de repolho rasgadas, muçarela de búfala, amêndoas laminadas, croutons e chips de copa, finalizados com um delicado molho de laranja e especiarias", "preco": 39 },
          { "nome": "Caesar", "desc": "Folhas frescas de alface rasgadas, envolvidas no clássico molho Caesar, acompanhadas de frango grelhado em cubos, croutons artesanais e finalizadas com parmesão ralado", "preco": 35 },
          { "nome": "Marieta", "desc": "Mix de folhas verdes combinado a presunto Parma, queijo de mofo azul, damascos secos e nozes crocantes. Servida com molho de aceto balsâmico e mel", "preco": 55 }
        ]
      }
    ]
  },
  {
    "id": "massas", "label": "Massas",
    "categorias": [
      {
        "titulo": "Massas",
        "itens": [
          { "nome": "Rigatoni com Pesto de Pistache e Burrata", "desc": "Rigatoni al dente envolto em pesto artesanal de pistache, cremoso e aromático. Finalizado com burrata fresca e folhas de manjericão", "preco": 89 },
          { "nome": "Alla Carbonara", "desc": "Spaghetti à moda romana, preparado com guanciale crocante e envolto em creme de ovos e parmesão. Finalizado com pimenta-do-reino moída e queijo caprino romano", "preco": 79 },
          { "nome": "Macarrão da Vó Marieta Alla Boscaiola", "desc": "Uma releitura da receita caseira da Vó Marieta: massa servida com molho boscaiola preparado com tomate pelado, guanciale, linguiça artesanal apimentada, cebola, azeitonas pretas, salsa e manjericão", "preco": 68 },
          { "nome": "Ai Frutti di Mare", "desc": "Spaghetti preparado com uma seleção de frutos do mar — camarões, lulas e mariscos — envolto em molho de tomate pelado, azeitonas pretas, salsa fresca e manjericão", "preco": 108 },
          { "nome": "Ravioli di Gamberi com Burro, Sálvia e Prezzemolo", "desc": "Massa artesanal al dente recheada com camarões, servida com clássico e aromático molho de manteiga de sálvia, vinho branco e salsa, finalizada com raspas de limão-siciliano", "preco": 92 },
          { "nome": "Gnocchi al Gorgonzola e Pere", "desc": "Gnocchi de batata macio e leve, servido com cremoso molho de queijo de mofo azul e peras delicadamente caramelizadas", "preco": 55 },
          { "nome": "Tagliatelle alla Mediterrânea", "desc": "Tagliatelle artesanal al dente, servido com bacalhau desfiado, tomate-cereja, azeitonas pretas e muçarela de búfala, finalizado com pesto aromático e folhas de manjericão", "preco": 89 },
          { "nome": "Gnocchi alla Bolognese", "desc": "Gnocchi artesanal e macio, servido com filé-mignon picado na ponta da faca, cozido em molho de tomates frescos e ervas aromáticas", "preco": 55 },
          { "nome": "Macarrão da Vó Marieta com Molho Branco, Pomodoro ou na Manteiga", "preco": 35 }
        ],
        "nota": "*Todas as massas podem ser preparadas nas versões sem glúten ou integral — penne ou spaghetti"
      },
      {
        "titulo": "Vegetariano / Vegano",
        "itens": [
          { "nome": "Berinjela Mediterrânea", "desc": "Berinjela grelhada servida sobre hommus cremoso, acompanhada de folhas verdes, tomatinhos salteados, amêndoas, sementes e molho tahine. Finalizada com azeite extravirgem, creme balsâmico e flor de sal", "preco": 60 }
        ]
      }
    ]
  },
  {
    "id": "carnes", "label": "Carnes",
    "categorias": [
      {
        "titulo": "Carnes",
        "itens": [
          { "nome": "Tagliata di Manzo", "desc": "Suculento bife de Ribeye Black Angus grelhado e fatiado, servido sobre rúcula, tomates-cereja, creme balsâmico e parmesão — a clássica tagliata italiana. Acompanha risoto cremoso de parmesão", "preco": 119 },
          { "nome": "Prime Rib", "desc": "Corte nobre de costela Black Angus, intensamente marmorizado, grelhado em alta temperatura e servido ao ponto mal passado. Macio e aromático, acompanha arroz biro-biro, farofa crocante de bacon, batatas rústicas e chimichurri. Serve 2 pessoas", "preco": 250 },
          { "nome": "Tornedor de Mignon", "desc": "Corte alto e nobre de filé-mignon Angus, grelhado e servido com redução de vinho tinto. Acompanha gnocchi caseiro tostado na manteiga e sálvia fresca", "preco": 98 },
          { "nome": "Filé a Parmegiana", "desc": "Tradicional prato paulistano, preparado com filé mignon Angus empanado e gratinado com muçarela. Servido sobre pomodoro rústico caseiro e finalizado com parmesão. Acompanha arroz branco e batata palha da casa", "preco": 75 },
          { "nome": "Filé Parmegiana Especial", "desc": "Filé mignon Angus empanado na farinha de milho especial sem glúten, gratinado com muçarela zero lactose e servido sobre pomodoro rústico caseiro. Acompanha arroz branco e batata palha da casa", "preco": 85 },
          { "nome": "Strogonoff de Mignon", "desc": "Receita clássica preparada com cubos de filé e cogumelos Paris frescos, flambados no conhaque e envolvidos em um molho cremoso à base de creme de leite fresco e mostarda Dijon. Servido com arroz branco e batata palha", "preco": 75 },
          { "nome": "Ribeye Grelhado", "desc": "Corte nobre de Ribeye Black Angus, reconhecido pelo marmoreio intenso, suculência e sabor marcante. Grelhado em alta temperatura e servido mal passado para máxima maciez. Acompanha batatas rústicas, legumes grelhados da estação e chimichurri artesanal", "preco": 119 },
          { "nome": "Filé Mignon ao Jus de Cogumelo", "desc": "Medalhão alto de filé mignon Angus, selado na manteiga de ervas e servido com jus aveludado de cogumelos Paris frescos. Acompanha risoto preparado com o próprio molho, finalizado com roti e salsa fresca", "preco": 109 },
          { "nome": "Filé au Poivre", "desc": "Medalhão alto de filé mignon Angus com crosta de pimenta-do-reino, servido com molho de conhaque, creme de leite fresco e vinho do Porto. Acompanha batatas sautée", "preco": 109 },
          { "nome": "Filé do Chef", "desc": "Suculento medalhão alto de filé-mignon Angus, grelhado e servido com molho roti aveludado. Acompanha tagliatelle caseiro ao molho de queijo de mofo azul", "preco": 98 },
          { "nome": "Costela Top Rib", "desc": "Costela Angus Top Rib — corte nobre e extremamente macio, assado lentamente até atingir textura que desfaz na boca. Servida com risoto de costela desfiada e finalizada com chimichurri artesanal", "preco": 109 },
          { "nome": "Filé Grelhado", "desc": "Corte clássico de filé-mignon Angus grelhado. Servido com arroz branco e batata frita crocante", "preco": 60 },
          { "nome": "Filé Cinco Queijos", "desc": "Filé-mignon Angus grelhado, gratinado com uma combinação de queijos — brie, mofo azul, requeijão, muçarela e parmesão. Acompanha arroz branco e batatas fritas crocantes", "preco": 80 }
        ]
      },
      {
        "titulo": "Suíno",
        "itens": [
          { "nome": "Porchetta", "desc": "Porchetta Duroc — corte de sabor marcante e textura extremamente suculenta — assada lentamente para garantir pele crocante e carne macia. Servida com risoto de limão-siciliano e molho cítrico", "preco": 95 }
        ]
      },
      {
        "titulo": "Ovino",
        "itens": [
          { "nome": "Costeletas de Cordeiro", "desc": "Suculento short rack de cordeiro Dorper Lamb — raça reconhecida pela maciez e sabor delicado — selado na manteiga e servido com risoto cremoso de damasco e queijo de mofo azul. Finalizado com redução de vinho do Porto e pó de hortelã", "preco": 185 }
        ]
      }
    ]
  },
  {
    "id": "peixes", "label": "Peixes",
    "categorias": [
      {
        "titulo": "Peixes & Frutos do Mar",
        "itens": [
          { "nome": "Bacalhau do Chef", "desc": "Lombo de bacalhau suculento, servido com mini batatinhas e cebolinhas tostadas, tomates-cereja, grão-de-bico, azeitonas pretas, salsa e dentes de alho assados. Finalizado com azeite extravirgem. Acompanha arroz branco", "preco": 179 },
          { "nome": "Salmão com Crosta de Pistache e Castanha", "desc": "Lombo de salmão assado com crosta crocante de pistache e castanha-de-caju. Servido com risoto de limão-siciliano", "preco": 109 },
          { "nome": "Linguado a Belle Meuniere", "desc": "Filé de linguado grelhado ao molho de manteiga, vinho branco, limão-siciliano, cogumelos Paris, camarões e alcaparras, servido sobre cama de batatas. Finalizado com raspas de limão-siciliano e salsa fresca", "preco": 115 },
          { "nome": "Polvo a Galega", "desc": "Polvo grelhado servido com batatas douradas e crisp de linguiça artesanal, equilibrado por muhammara (creme de pimentão assado) e picles de cebola. Finalizado com agrião e azeite extravirgem e páprica defumada", "preco": 189 }
        ]
      }
    ]
  },
  {
    "id": "risotos", "label": "Risotos",
    "categorias": [
      {
        "titulo": "Risotos",
        "itens": [
          { "nome": "Costela", "desc": "Risoto caldoso preparado com costela desfiada, finalizado com cebola frita curtida em chili crunch e salsa fresca", "preco": 69 },
          { "nome": "Alla Chef", "desc": "Risoto de funghi secchi, finalizado com brie derretido e avelãs tostadas. Recebe um toque de frescor com frutas vermelhas da estação e redução de vinho tinto", "preco": 72 },
          { "nome": "Parmeggiano", "desc": "Clássico risoto preparado com parmesão e grana padano, resultando em cremosidade intensa e sabor marcante", "preco": 59 },
          { "nome": "Filé e Gorgonzola", "desc": "Cubos de mignon Angus grelhados, preservando suculência e maciez, servidos em harmonia com a intensidade e cremosidade do queijo de mofo azul", "preco": 69 },
          { "nome": "Bacalhau", "desc": "Risoto cremoso combinado à intensidade e suculência do bacalhau, finalizado com azeitonas pretas, salsa fresca e azeite extravirgem", "preco": 89 },
          { "nome": "Risoto Caprese", "desc": "Risoto cremoso preparado com tomate pelado e pesto de manjericão, finalizado com burrata fresca", "preco": 72 },
          { "nome": "Risoto de Camarão", "desc": "Risoto cremoso preparado com tomate pelado e camarões-rosa cozidos em seu próprio caldo, resultando em sabor profundo e equilibrado. Finalizado com um camarão-rosa inteiro, conferindo elegância ao prato", "preco": 110 },
          { "nome": "Risoto de Limão Siciliano", "desc": "Risoto leve e refrescante, preparado com raspas e suco de limão-siciliano e vinho branco", "preco": 59 },
          { "nome": "Risoto de Palmito", "desc": "Risoto cremoso e delicado, preparado com palmito macio e vinho branco. Finalizado com palmitos em toletes grelhados e parmesão ralado", "preco": 69 }
        ]
      }
    ]
  },
  {
    "id": "sobremesas", "label": "Sobremesas",
    "categorias": [
      {
        "titulo": "Sobremesas",
        "itens": [
          { "nome": "Pudim", "desc": "Sobremesa clássica, finalizada com calda de caramelo artesanal", "preco": 22 },
          { "nome": "Torta Fudge de Chocolate", "desc": "Torta cremosa e densa, preparada com chocolate belga meio amargo e doce de leite, resultando em textura aveludada e indulgente. Finalizada com chantili e caramelo salgado", "preco": 27 },
          { "nome": "Cartola", "desc": "Sobremesa tradicional de Pernambuco, com camadas de banana caramelizada e queijo coalho dourado, equilibrando doçura e leve salgado. Finalizada com açúcar, canela e toque de doce de leite. Servida com sorvete de chocolate branco", "preco": 29 },
          { "nome": "Goiabada Tragaluz", "desc": "Tradicional sobremesa do restaurante homônimo em Tiradentes/MG, com goiabada cascão prensada no xerém e dourada na manteiga, servida sobre queijo cremoso. Acompanha gelatto de goiabada", "preco": 29 },
          { "nome": "Cheesecake de Doce de Leite", "desc": "Sobremesa à base de queijo cremoso e doce de leite, sobre base crocante e cobertura de chocolate Belga meio amargo", "preco": 22 },
          { "nome": "Brownie com Sorvete", "desc": "Textura densa, interior macio e sabor intenso de chocolate. Servido com delicioso sorvete artesanal de chocolate branco e calda de chocolate", "preco": 25 },
          { "nome": "Pera Belle Marieta", "desc": "Pera delicadamente cozida em vinho tinto aromático, servida com sorvete de chocolate branco e finalizada com calda aveludada do mesmo vinho e amêndoas laminadas", "preco": 32 }
        ]
      }
    ]
  },
  {
    "id": "drinks", "label": "Drinks",
    "categorias": [
      {
        "titulo": "Drinks",
        "itens": [
          { "nome": "Caipiroska", "desc": "Versão clássica da caipirinha, preparada com vodka Absolut, limão macerado e açúcar, refrescante e equilibrada", "preco": 20 },
          { "nome": "Cuba Libre", "desc": "Rum, Coca-Cola e limão combinam em uma bebida refrescante, com perfeito equilíbrio entre o doce e o ácido", "preco": 23 },
          { "nome": "Campari Spritz", "desc": "Campari, prosecco e um toque de limão se unem em uma bebida efervescente, sofisticada e levemente amarga", "preco": 35 },
          { "nome": "Dry Martini", "desc": "Gin e Martini Bianco, finalizados com azeitonas verdes, em um coquetel seco, elegante e icônico", "preco": 39 },
          { "nome": "Caipirinha Clássica", "desc": "Cachaça, limão, açúcar e gelo, harmonizando a acidez do limão com a doçura e intensidade da cachaça", "preco": 15 },
          { "nome": "Hanky Panky", "desc": "Gin, Martini Rosso e Fernet branca combinam notas herbais e amargor sutil em um coquetel clássico e complexo", "preco": 37 },
          { "nome": "Hugo Spritz", "desc": "Licor de flor de sabugueiro, prosecco, água com gás, hortelã e limão-siciliano em um coquetel refrescante e aromático", "preco": 35 },
          { "nome": "Limoncello Spritz", "desc": "Licor de limão-siciliano, prosecco e água com gás, finalizado com espuma de gengibre", "preco": 35 },
          { "nome": "Macunaíma", "desc": "Cachaça, limão e Fernet branca combinam em um coquetel exótico, ousado e refrescante", "preco": 15 },
          { "nome": "Mojito", "desc": "Rum branco, limão, hortelã e água com gás em um clássico drink leve e revigorante", "preco": 25 },
          { "nome": "Moscow Mule", "desc": "Vodka, suco de limão e ginger ale com espuma de gengibre, criando um coquetel fresco e equilibrado", "preco": 35 },
          { "nome": "Negroni", "desc": "Clássico coquetel italiano com gin, Campari e Martini Rosso, intenso e sofisticado", "preco": 32 },
          { "nome": "Aperol Spritz", "desc": "Aperol, prosecco e água com gás formam um coquetel vibrante, levemente amargo e visualmente irresistível", "preco": 29 },
          { "nome": "Carajillo", "desc": "Clássico espanhol que combina café espresso intenso com Licor 43. Servido gelado, equilibrado e perfeito para encerrar a refeição", "preco": 37 },
          { "nome": "Old Fashioned", "desc": "Bourbon, xarope e bitter aromático delicadamente mexidos e finalizados com toque cítrico. Encorpado, equilibrado e intenso", "preco": 25 },
          { "nome": "Manhattan", "desc": "Whisky bourbon, vermute tinto e bitter aromático, servido gelado e finalizado com cereja", "preco": 35 },
          { "nome": "Sex on the Beach", "desc": "Vodka, licor de pêssego e suco de laranja se combinam em um drink tropical, leve, frutado e vibrante", "preco": 35 },
          { "nome": "Campari Sour", "desc": "Campari, limão e açúcar em equilíbrio perfeito, finalizado com espuma aveludada", "preco": 29 },
          { "nome": "Bloody Mary", "desc": "Suco de tomate, vodka e mistura de temperos e condimentos, em um coquetel clássico, refrescante e levemente picante", "preco": 29 },
          { "nome": "Gin Tônica", "desc": "Refrescância do gin combinada com efervescência da água tônica e seleção de especiarias, resultando em uma bebida limpa, aromática e elegante", "preco": 33 }
        ]
      },
      {
        "titulo": "Drinks sem Álcool",
        "itens": [
          { "nome": "Verão in Marieta", "desc": "Mocktail leve e refrescante preparado com tônica pink lemonade, suco e xarope de limão-siciliano. Aromatizado com ervas frescas e servido com bastante gelo", "preco": 22 },
          { "nome": "Sodas Italianas", "desc": "Bebida refrescante feita com água gaseificada, xarope de frutas e gelo. Sabores: Gengibre, Limão siciliano, Maçã verde, Frutas vermelhas, Flor de sabugueiro", "preco": 20 }
        ]
      }
    ]
  },
  {
    "id": "bebidas", "label": "Bebidas",
    "categorias": [
      {
        "titulo": "Cervejas",
        "itens": [
          { "nome": "Corona Extra 330ml", "preco": 12 },
          { "nome": "Heineken 330ml", "preco": 12 },
          { "nome": "Stella Artois 330ml", "preco": 12 },
          { "nome": "Blue Moon 355ml", "preco": 17 },
          { "nome": "Baden Baden Cristal Pilsen 600ml", "preco": 25 },
          { "nome": "Baden Baden Golden 600ml", "preco": 25 },
          { "nome": "Baden Baden IPA 600ml", "preco": 25 },
          { "nome": "Colorado Appia 600ml", "preco": 25 },
          { "nome": "Colorado Lager 600ml", "preco": 25 },
          { "nome": "Paulaner Weissbier 500ml", "preco": 27 },
          { "nome": "Corona Zero / Heineken Zero 330ml", "preco": 13 },
          { "nome": "Stella Artois sem Glúten / Michelob Ultra 330ml", "preco": 13 }
        ]
      },
      {
        "titulo": "Destilados — Doses",
        "itens": [
          { "nome": "Campari", "preco": 16 },
          { "nome": "Gin Tanqueray London Dry", "preco": 23 },
          { "nome": "Licor 43", "preco": 32 },
          { "nome": "Vodka Absolut", "preco": 16 },
          { "nome": "Whisky Bourbon Woodford Reserve", "preco": 40 },
          { "nome": "Whisky Chivas 18 anos", "preco": 55 },
          { "nome": "Whisky Chivas 12 anos", "preco": 25 },
          { "nome": "Whisky Johnnie Walker Double Black", "preco": 30 },
          { "nome": "Whisky Old Parr 12 anos", "preco": 25 },
          { "nome": "Whisky Jim Beam Bourbon", "preco": 30 }
        ]
      },
      {
        "titulo": "Águas, Refrigerantes e Sucos",
        "itens": [
          { "nome": "Água Mineral Acqua Panna / Perrier com Gás", "preco": 18 },
          { "nome": "Água Mineral sem/com Gás Prata", "preco": 8.5 },
          { "nome": "Coca-Cola / Coca-Cola Zero / Guaraná / Guaraná Zero — lata", "preco": 8.5 },
          { "nome": "Sprite / Sprite Zero — lata", "preco": 8.5 },
          { "nome": "Água Tônica / Tônica Zero — lata", "preco": 8.5 },
          { "nome": "H2Oh Limão / Limoneto", "preco": 10 },
          { "nome": "Sucos 100% Natural 300ml", "desc": "Uva, Tangerina, Maçã com hibisco/canela/gengibre, Pink lemonade, Pêssego, Laranja", "preco": 17 }
        ]
      },
      {
        "titulo": "Cafés",
        "itens": [
          { "nome": "Café Nespresso Ristretto", "preco": 9 },
          { "nome": "Café Nespresso Arpeggio", "preco": 9 },
          { "nome": "Café Nespresso Arpeggio Descafeinado", "preco": 9.5 }
        ]
      },
      {
        "titulo": "Porções Extras",
        "itens": [
          { "nome": "Arroz Biro Biro", "preco": 15 },
          { "nome": "Arroz Branco", "preco": 10 },
          { "nome": "Aligot", "preco": 30 },
          { "nome": "Purê de Batatas", "preco": 15 },
          { "nome": "Queijo Grana Padano Ralado", "preco": 14 },
          { "nome": "Queijo Parmesão Ralado", "preco": 7 },
          { "nome": "Gnocchi na Manteiga e Sálvia", "preco": 25 },
          { "nome": "Filé Grelhado", "preco": 49 },
          { "nome": "Batata Frita / Rústica / Palha", "preco": 30 },
          { "nome": "Molho Roti / Molho Pesto", "preco": 10 },
          { "nome": "Bola de Sorvete", "preco": 10 }
        ]
      },
      {
        "titulo": "Vinhos",
        "itens": [
          { "nome": "Acesse nossa carta de vinhos online ou consulte o garçom" },
          { "nome": "Taxa de Rolha", "preco": 60 }
        ]
      }
    ]
  }
]

await setDoc(doc(db, 'restaurants', 'marieta-bistro', 'data', 'cardapio'), {
  content: cardapioData,
  updatedAt: new Date().toISOString()
})

console.log('Cardápio com preços atualizado no Firestore!')
process.exit(0)
