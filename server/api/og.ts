import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import { readFileSync } from 'fs'
import { join } from 'path'
import { defineEventHandler, getQuery, setHeader, send } from 'h3'

const fontPath = join(process.cwd(), 'node_modules/@fontsource/inter/files/inter-latin-400-normal.woff')
const fontData = readFileSync(fontPath)

export default defineEventHandler(async (event) => {
    const { code = '????' } = getQuery(event)

    const svg = await satori(
        {
            type: 'div',
            props: {
                style: {
                    width: '1200px',
                    height: '630px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    background: 'linear-gradient(135deg, #0f0f0f, #1f1f1f)',
                    color: '#fff',
                    fontFamily: 'Inter',
                },
                children: [
                    {
                        type: 'div',
                        props: {
                            style: {
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                backgroundColor: '#111',
                                borderRadius: '20px',
                                padding: '40px 60px',
                                border: '2px solid #444',
                                boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
                            },
                            children: [
                                {
                                    type: 'img',
                                    props: {
                                        src: 'https://ufp.ppo.gg/img/unfit_logo_alt.png',
                                        width: 320,
                                        height: 320,
                                        alt: 'Logo',
                                        style: {
                                            borderRadius: '12px',
                                            marginBottom: '20px',
                                        }
                                    }
                                },
                                {
                                    type: 'p',
                                    props: {
                                        children: `Join Game Code: ${code}`,
                                        style: {
                                            fontSize: '32px',
                                            marginTop: '10px',
                                            color: '#bbb',
                                        }
                                    }
                                }
                            ]
                        }
                    }
                ]
            }
        },
        {
            width: 1200,
            height: 630,
            fonts: [
                {
                    name: 'Inter',
                    data: fontData,
                    weight: 400,
                    style: 'normal',
                }
            ]
        }
    )

    const png = new Resvg(svg).render().asPng()
    setHeader(event, 'Content-Type', 'image/png')
    return send(event, png)
})
