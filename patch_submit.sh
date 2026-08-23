#!/bin/bash
FILE=$1

cat << 'INNER_EOF' > /tmp/submit_replace.txt
      await addDoc(collection(db, "sugestoes"), {
        userId: user?.uid,
        condominio: (profile as any)?.nomeEmpresa || (profile as any)?.nomeCompleto || profile?.displayName || "",
        sindico: (profile as any)?.nomeResponsavel || (profile as any)?.nomeCompleto || profile?.displayName || "",
        telefone: (profile as any)?.telefone || "",
        email: profile?.email || user?.email || "",
        titulo: "Sugestão",
        mensagem: suggestionText,
        status: "Nova",
        createdAt: new Date(),
      });
      await addDoc(collection(db, "mail"), {
        to: "ceo@uniaocondominial.com.br",
        message: {
          subject: "Nova Sugestão Recebida - Aplicativo",
          html: `
            <h3>Nova Sugestão Recebida</h3>
            <p><strong>Condomínio/Empresa:</strong> ${(profile as any)?.nomeEmpresa || (profile as any)?.nomeCompleto || profile?.displayName || ""}</p>
            <p><strong>Responsável:</strong> ${(profile as any)?.nomeResponsavel || (profile as any)?.nomeCompleto || profile?.displayName || ""}</p>
            <p><strong>Telefone:</strong> ${(profile as any)?.telefone || ""}</p>
            <p><strong>E-mail:</strong> ${profile?.email || user?.email || ""}</p>
            <br />
            <p><strong>Sugestão:</strong></p>
            <p>${suggestionText.replace(/\n/g, '<br/>')}</p>
          `
        }
      });
      setIsSuggestionSuccess(true);
      setSuggestionText("");
    } catch (error) {
INNER_EOF

sed -i '/await addDoc(collection(db, "sugestoes"), {/,/    } catch (error) {/c\
$(cat /tmp/submit_replace.txt)' $FILE
