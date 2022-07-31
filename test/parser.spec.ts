import { parse } from '../src/parser'

describe('parse', () => {
  it('parses correctly', () => {
    expect('' + parse('1')).toEqual('1')
    expect('' + parse('3*4+5*6')).toEqual('(+ (* 3 4) (* 5 6))')
    expect('' + parse('3*(4+5)*6')).toEqual('(* (* 3 (+ 4 5)) 6)')
    expect('' + parse('1..2')).toEqual('(.. 1 2)')
    expect('' + parse('1k..10k')).toEqual('(.. (* 1 1000) (* 10 1000))')
    expect('' + parse('1..2+5')).toEqual('(.. 1 (+ 2 5))')
    expect('' + parse('1+2..2+5')).toEqual('(.. (+ 1 2) (+ 2 5))')
    expect('' + parse('1;2')).toEqual('(; 1 2)')
    expect('' + parse('1;2;3')).toEqual('(; (; 1 2) 3)')
    expect('' + parse('1||2')).toEqual('(|| 1 2)')
    expect('' + parse('1>>2')).toEqual('(>> 1 2)')
    expect('' + parse('1||2&&3')).toEqual('(|| 1 (? (!= 0 2) 3 0))')
    expect('' + parse('1&&2||3')).toEqual('(|| (? (!= 0 1) 2 0) 3)')
    expect('' + parse('+1')).toEqual('(+ 1)')
    expect('' + parse('a(z)')).toEqual('(@ a z)')
    expect('' + parse('a(z=1)')).toEqual('(@ a (= z 1))')
    expect('' + parse('x=a(1)')).toEqual('(= x (@ a 1))')
    expect('' + parse('a(1 + 2)')).toEqual('(@ a (+ 1 2))')
    expect('' + parse('a(1 + 2, 3)')).toEqual('(@ a (, (+ 1 2) 3))')
    expect('' + parse('a(1 + 2, b(3))')).toEqual('(@ a (, (+ 1 2) (@ b 3)))')
    expect('' + parse('a(1 + 2, b(3), c[1])')).toEqual('(@ a (, (, (+ 1 2) (@ b 3)) ([ c 1)))')
    expect('' + parse('!1')).toEqual('(! 1)')
    expect('' + parse('.1')).toEqual('0.1')
    expect('' + parse('!!1')).toEqual('(! (! 1))')
    expect('' + parse('!!1*2')).toEqual('(* (! (! 1)) 2)')
    expect(() => parse('1+')).toThrow('ParserUnknownError: [eof]')
    expect('' + parse('1 + +-1')).toEqual('(+ 1 (+ (- 1)))')
    expect('' + parse('1 + 2 * 3')).toEqual('(+ 1 (* 2 3))')
    expect('' + parse('a + b * c * d + e')).toEqual('(+ (+ a (* (* b c) d)) e)')
    // expect('' + parse('f . g . h')).toEqual('(. (. f g) h)')
    // expect('' + parse('1 + 2 + f . g . h * 3 * 4')).toEqual('(+ (+ 1 2) (* (* (. (. f g) h) 3) 4))')
    expect('' + parse('--a * 2')).toEqual('(* (= a (- a 1)) 2)')
    expect('' + parse('++a * 2')).toEqual('(* (= a (+ a 1)) 2)')
    expect('' + parse('a--')).toEqual('(= a (- a 1))')
    expect('' + parse('a++')).toEqual('(= a (+ a 1))')
    // expect('' + parse('--a--')).toEqual('(= (= a (- a 1)) (- (= a (- a 1)) 1))')
    // expect('' + parse('++a++')).toEqual('(= (= a (+ a 1)) (+ (= a (+ a 1)) 1))')
    // expect('' + parse('--f . g')).toEqual('(= (. f g) (- (. f g) 1))')
    // expect('' + parse('f . g--')).toEqual('(= (. f g) (- (. f g) 1))')
    // expect('' + parse('--!f . g')).toEqual('(-- (! (. f g)))')
    // expect('' + parse('!--f . g')).toEqual('(! (= (. f g) (- (. f g) 1)))')
    expect(() => parse('-9!0')).toThrow('ParserUnknownError: [ops]: !')
    expect('' + parse('1+!0')).toEqual('(+ 1 (! 0))')
    // expect('' + parse('! f . g ')).toEqual('(! (. f g))')
    expect('' + parse('(((0)))')).toEqual('0')
    expect('' + parse('x[0][1]')).toEqual('([ ([ x 0) 1)')
    expect('' + parse('x[y[1]]')).toEqual('([ x ([ y 1))')
    expect('' + parse(`a ? b : c ? d : e`)).toEqual('(? a b (? c d e))')
    expect('' + parse('a = 0 ? b : c = d')).toEqual('(= a (? 0 b (= c d)))')
    expect('' + parse('{x,y}')).toEqual('({ (, x y))')
    expect('' + parse('{x,y,z}')).toEqual('({ (, (, x y) z))')
    expect('' + parse('{x,y,z}=(a,b,c)')).toEqual('(= ({ (, (, x y) z)) (, (, a b) c))')
  })

  it('throws on errors', () => {
    expect(() => parse('(')).toThrow('Expected: \')\' [ops]')
    expect(() => parse('(1')).toThrow('Expected: \')\' [ops]')
    expect(() => parse('a[')).toThrow('Expected: \']\' [ops]')
    expect(() => parse('a[1')).toThrow('Expected: \']\' [ops]')
    expect(() => parse('')).not.toThrow()
  })

  describe('multiline', () => {
    it('parses multiline', () => {
      expect(
        ''
          + parse(`
          3 * 4
        + 5 * 6
        `)
      ).toEqual('(+ (* 3 4) (* 5 6))')
    })

    it('ignores single line comments', () => {
      expect(
        ''
          + parse(`
          \\ comment
          3 * 4 \\ a comment
        + 5 * 6
        \\ more comments
        `)
      ).toEqual('(+ (* 3 4) (* 5 6))')
    })

    it('ignores block comments', () => {
      expect(
        ''
          + parse(`
          \\ comment
          3\\*careful
          mutliline*\\ * 4 \\ a comment
        + 5 *\\*another*\\ 6
        \\ more comments
        `)
      ).toEqual('(+ (* 3 4) (* 5 6))')
    })
  })

  describe('buffer ops', () => {
    it('ref', () => {
      expect('' + parse('#1')).toEqual('#1')
    })

    it('create/allocate', () => {
      expect('' + parse('#1:4')).toEqual('(: #1 4)')
      expect('' + parse('#1:4,2')).toEqual('(: #1 (, 4 2))')
      expect('' + parse('#1:4,2;foo')).toEqual('(; (: #1 (, 4 2)) foo)')
    })

    it('map/reduce', () => {
      expect('' + parse('#1::foo')).toEqual('(:: #1 foo)')
    })

    it('read', () => {
      expect('' + parse('#(1)')).toEqual('(@ # 1)')
      expect('' + parse('#(-1)')).toEqual('(@ # (- 1))')
      expect('' + parse('#(1+2)')).toEqual('(@ # (+ 1 2))')
    })

    it('write', () => {
      expect('' + parse('#1=2')).toEqual('(= #1 2)')
      expect('' + parse('#=2')).toEqual('(= # 2)')
      expect('' + parse('#(1+2)=3')).toEqual('(= (@ # (+ 1 2)) 3)')
      expect('' + parse('#=x+y*fb')).toEqual('(= # (+ x (* y fb)))')
    })
  })

  describe('parameters', () => {
    it('parses', () => {
      expect('' + parse('a()=x')).toEqual('(= (@ a) x)')
      expect('' + parse('a(z)=x')).toEqual('(= (@ a z) x)')
      expect('' + parse('a(z[0..2])=x')).toEqual('(= (@ a ([ z (.. 0 2))) x)')
      expect('' + parse('a(.z[0..2])=x')).toEqual('(= (@ a (. ([ z (.. 0 2)))) x)')
      expect('' + parse('a(z[0..2]=2)=x')).toEqual('(= (@ a (= ([ z (.. 0 2)) 2)) x)')
      expect('' + parse('a(.z[0..2]=2)=x')).toEqual('(= (@ a (= (. ([ z (.. 0 2))) 2)) x)')
      expect('' + parse('a(z[0..2],b[4.5..8.5])=x')).toEqual('(= (@ a (, ([ z (.. 0 2)) ([ b (.. 4.5 8.5)))) x)')
      expect('' + parse('a(z[0..2]=1,b[4.5..8.5]=2)=x')).toEqual(
        '(= (@ a (, (= ([ z (.. 0 2)) 1) (= ([ b (.. 4.5 8.5)) 2))) x)'
      )
    })
  })

  describe('assignment', () => {
    it('single variable', () => {
      expect('' + parse('a=1')).toEqual('(= a 1)')
      expect('' + parse('a+=1')).toEqual('(= a (+ a 1))')
      expect('' + parse('a=1+2')).toEqual('(= a (+ 1 2))')
      expect('' + parse('a=1+2/3')).toEqual('(= a (+ 1 (/ 2 3)))')
    })

    it('multi variable', () => {
      expect('' + parse('(a,b)=(1,2)')).toEqual('(= (, a b) (, 1 2))')
    })
  })

  describe('numbers', () => {
    it('floats with leading . dot', () => {
      expect('' + parse('.1')).toEqual('0.1')
      expect('' + parse('.1e2')).toEqual('10.0')
      expect('' + parse('.1e-2')).toEqual('0.001')
      expect('' + parse('.1e+2')).toEqual('10.0')
      expect('' + parse('.0')).toEqual('0.0')
      expect('' + parse('.01')).toEqual('0.01')
    })

    it('floats with trailing f', () => {
      expect('' + parse('1f')).toEqual('1.0')
      expect('' + parse('10f')).toEqual('10.0')
    })

    it('floats with trailing dot .', () => {
      expect('' + parse('1.0')).toEqual('1.0')
      expect('' + parse('1.e2')).toEqual('100.0')
      expect('' + parse('1.e-2')).toEqual('0.01')
      expect('' + parse('1.e+2')).toEqual('100.0')
      expect('' + parse('0.0')).toEqual('0.0')
      expect('' + parse('01.0')).toEqual('1.0')
    })

    it('seconds', () => {
      expect('' + parse('1s')).toEqual('(* 1 sr)')
      expect('' + parse('.5s')).toEqual('(* 0.5 sr)')
      expect('' + parse('1ms')).toEqual('(* (* 1 sr) 0.001)')
    })

    it('kK', () => {
      expect('' + parse('1k')).toEqual('(* 1 1000)')
      expect('' + parse('1K')).toEqual('(* 1 1024)')
    })

    it('beat/bar', () => {
      expect('' + parse('1b')).toEqual('(* 1 br)')
      expect('' + parse('1B')).toEqual('(* (* 1 br) mr)')
    })
  })

  describe('semicolons', () => {
    it('middle', () => {
      expect('' + parse('1;1')).toEqual('(; 1 1)')
      expect('' + parse('1;;1')).toEqual('(; 1 1)')
      expect('' + parse('1;;;1')).toEqual('(; 1 1)')
      expect('' + parse('1 ; ; ; 1')).toEqual('(; 1 1)')
    })

    it('head', () => {
      expect('' + parse(';1')).toEqual('1')
      expect('' + parse(';;1')).toEqual('1')
      expect('' + parse(';;;1')).toEqual('1')
      expect('' + parse('; ; ;1')).toEqual('1')
    })

    it('head + middle', () => {
      expect('' + parse(';1;2')).toEqual('(; 1 2)')
      expect('' + parse(';;1;;2')).toEqual('(; 1 2)')
      expect('' + parse(';;;1;;;2')).toEqual('(; 1 2)')
      expect('' + parse('; ; ;1; ; ; 2')).toEqual('(; 1 2)')
    })

    it('tail', () => {
      expect('' + parse('1;')).toEqual('1')
      expect('' + parse('1;;')).toEqual('1')
      expect('' + parse('1;;;')).toEqual('1')
      expect('' + parse('1; ; ;')).toEqual('1')
    })
  })
})
