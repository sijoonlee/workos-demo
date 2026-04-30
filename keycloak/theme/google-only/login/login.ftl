<#import "template.ftl" as layout>
<@layout.registrationLayout displayInfo=social.displayInfo; section>
    <#if section = "title">
        ${msg("loginTitle",(realm.displayName!''))}
    <#elseif section = "form">
        <#if social.providers??>
            <div id="kc-social-providers" class="${properties.kcFormSocialAccountListClass!}">
                <#list social.providers as p>
                    <a id="social-${p.alias}"
                       class="${properties.kcFormSocialAccountListButtonClass!}"
                       href="${p.loginUrl}">
                        <#if p.iconClasses?has_content>
                            <i class="${properties.kcCommonLogoIdP!} ${p.iconClasses!}" aria-hidden="true"></i>
                            <span class="${properties.kcFormSocialAccountNameClass!} kc-social-icon-text">${p.displayName!}</span>
                        <#else>
                            <span class="${properties.kcFormSocialAccountNameClass!}">${p.displayName!}</span>
                        </#if>
                    </a>
                </#list>
            </div>
        <#else>
            <p>No identity providers configured.</p>
        </#if>
    </#if>
</@layout.registrationLayout>
